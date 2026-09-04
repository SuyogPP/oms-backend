import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { CreateOrgUnitDto } from '../dto/create-org-unit.dto';
import { MoveOrgUnitDto } from '../dto/move-org-unit.dto';
import { IOrgUnit } from '../interfaces/org-unit.interface';
import { ORG_ERROR_CODES } from '../org-units.constants';
import { OrgUnitChangeLogRepository } from '../repositories/org-unit-change-log.repository';
import { OrgUnitClosureRepository } from '../repositories/org-unit-closure.repository';
import { OrgUnitsRepository } from '../repositories/org-units.repository';

/**
 * OrgUnitTreeService
 *
 * The single authoritative service owning closure table and materialized path maintenance.
 * Nothing else in the codebase may write to org.OrgUnitClosure or org.OrgUnits.MaterializedPath.
 */
@Injectable()
export class OrgUnitTreeService {
  private readonly logger = new Logger(OrgUnitTreeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly orgUnitsRepository: OrgUnitsRepository,
    private readonly closureRepository: OrgUnitClosureRepository,
    private readonly changeLogRepository: OrgUnitChangeLogRepository,
    private readonly configService: ConfigService,
  ) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Helper to format MaterializedPath segment: strips GUID dashes and converts to uppercase.
   */
  private formatGuidSegment(id: string): string {
    return id.replace(/-/g, '').toUpperCase();
  }

  /**
   * Creates a new organization unit node and maintains closure table + materialized path.
   *
   * @param dto Create parameters
   * @param actorUserId User performing creation
   * @param parentUnit Parent unit if non-root, null for root
   * @param existingQr Optional QueryRunner for enlisting in caller transaction
   */
  async createNode(
    dto: CreateOrgUnitDto,
    actorUserId: string,
    parentUnit: IOrgUnit | null,
    existingQr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const isExternalTx = Boolean(existingQr);
    const qr = existingQr || this.dataSource.createQueryRunner();

    if (!isExternalTx) {
      await qr.connect();
      await qr.startTransaction();
    }

    try {
      const newId = randomUUID();
      const cleanSegment = this.formatGuidSegment(newId);

      let depth = 0;
      let materializedPath = `/${cleanSegment}/`;

      if (parentUnit) {
        depth = parentUnit.depth + 1;
        const parentPath = parentUnit.materializedPath.endsWith('/')
          ? parentUnit.materializedPath
          : `${parentUnit.materializedPath}/`;
        materializedPath = `${parentPath}${cleanSegment}/`;
      }

      // 1. Insert OrgUnits row
      const created = await this.orgUnitsRepository.create(
        {
          orgUnitTypeId: dto.orgUnitTypeId,
          parentOrgUnitId: parentUnit ? parentUnit.orgUnitId : null,
          code: dto.code,
          name: dto.name,
          nameAr: dto.nameAr,
          shortName: dto.shortName,
          description: dto.description,
          materializedPath,
          depth,
          costCenterCode: dto.costCenterCode,
          oracleOrgCode: dto.oracleOrgCode,
          emailAddress: dto.emailAddress,
          phoneNumber: dto.phoneNumber,
          sortOrder: dto.sortOrder ?? 0,
          effectiveFrom:
            dto.effectiveFrom ?? new Date().toISOString().split('T')[0],
          createdBy: actorUserId,
        },
        qr,
      );

      // 2. Insert OrgUnitClosure rows (§6.1)
      await this.closureRepository.insertNodeClosure(
        created.orgUnitId,
        parentUnit ? parentUnit.orgUnitId : null,
        qr,
      );

      // 3. Write change log
      await this.changeLogRepository.create(
        {
          orgUnitId: created.orgUnitId,
          changeType: 'CREATED',
          oldParentOrgUnitId: null,
          newParentOrgUnitId: parentUnit ? parentUnit.orgUnitId : null,
          newValues: {
            code: dto.code,
            name: dto.name,
            orgUnitTypeId: dto.orgUnitTypeId,
            depth,
            materializedPath,
          },
          affectedNodeCount: 1,
          reason: 'Initial creation',
          performedBy: actorUserId,
        },
        qr,
      );

      // 4. Debug integrity verification
      await this.runIntegrityCheckIfDebug(qr);

      if (!isExternalTx) {
        await qr.commitTransaction();
      }

      return created;
    } catch (error) {
      if (!isExternalTx) {
        await qr.rollbackTransaction();
      }
      throw error;
    } finally {
      if (!isExternalTx) {
        await qr.release();
      }
    }
  }

  /**
   * §6.2 Executes the atomic reorganization sequence:
   * 1. Subtree Locking (§11.1)
   * 2. Concurrency Check (RowVersion)
   * 3. Detach closure (Step 1)
   * 4. Attach closure (Step 2)
   * 5. Update adjacency parent
   * 6. Recompute depth across subtree
   * 7. Rebuild materialized paths across subtree
   * 8. Write change log with AffectedNodeCount
   * 9. Debug integrity verification
   */
  async moveSubtree(
    nodeId: string,
    dto: MoveOrgUnitDto,
    actorUserId: string,
    existingQr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const isExternalTx = Boolean(existingQr);
    const qr = existingQr || this.dataSource.createQueryRunner();

    if (!isExternalTx) {
      await qr.connect();
      await qr.startTransaction();
    }

    try {
      // 1. Lock subtree closure rows (§11.1)
      await qr.query(
        `SELECT 1 FROM org.OrgUnitClosure WITH (UPDLOCK, HOLDLOCK) WHERE AncestorOrgUnitId = @0;`,
        [nodeId],
      );

      // 2. Fetch moving unit and perform optimistic concurrency check
      const movingUnit = await this.orgUnitsRepository.findById(nodeId, qr);
      if (!movingUnit) {
        throw new HttpException(
          {
            code: ORG_ERROR_CODES.ORG_NOT_FOUND,
            message: `Organization unit [${nodeId}] was not found.`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Root cannot be moved (§7.3 D5)
      if (
        movingUnit.parentOrgUnitId === null ||
        movingUnit.orgUnitTypeId === 1
      ) {
        throw new HttpException(
          {
            code: ORG_ERROR_CODES.ORG_ROOT_PROTECTED,
            message:
              'The root holding organization unit is protected and cannot be reparented.',
          },
          HttpStatus.CONFLICT,
        );
      }

      // Optimistic concurrency verification (§11.1)
      const currentToken = movingUnit.rowVersion
        .toLowerCase()
        .replace(/^0x/, '');
      const expectedToken = dto.rowVersion.toLowerCase().replace(/^0x/, '');
      if (currentToken !== expectedToken) {
        throw new HttpException(
          {
            code: ORG_ERROR_CODES.ORG_CONCURRENCY_CONFLICT,
            message:
              'The organization unit has been modified by another transaction. Please reload and retry.',
          },
          HttpStatus.CONFLICT,
        );
      }

      // 3. Step 1: Detach closure (§6.2)
      await this.closureRepository.detachSubtree(nodeId, qr);

      // 4. Step 2: Attach closure (§6.2)
      await this.closureRepository.attachSubtree(
        nodeId,
        dto.newParentOrgUnitId,
        qr,
      );

      // 5. Update adjacency parent on moving node
      await qr.query(
        `UPDATE org.OrgUnits 
         SET ParentOrgUnitId = @1, 
             UpdatedBy = @2, 
             UpdatedAt = SYSUTCDATETIME() 
         WHERE OrgUnitId = @0;`,
        [nodeId, dto.newParentOrgUnitId, actorUserId],
      );

      // 6. Recompute depth across the subtree from closure table (§6.2)
      await this.recomputeDepthForSubtree(nodeId, qr);

      // 7. Rebuild MaterializedPath for the entire subtree via recursive CTE (§6.2)
      await this.rebuildPathsForSubtree(nodeId, qr);

      // 8. Calculate affected node count
      const subtreeIds = await this.closureRepository.getDescendantIds(
        nodeId,
        qr,
      );
      const affectedNodeCount = subtreeIds.length;

      // 9. Write change log
      await this.changeLogRepository.create(
        {
          orgUnitId: nodeId,
          changeType: 'MOVED',
          oldParentOrgUnitId: movingUnit.parentOrgUnitId,
          newParentOrgUnitId: dto.newParentOrgUnitId,
          oldValues: {
            parentOrgUnitId: movingUnit.parentOrgUnitId,
            depth: movingUnit.depth,
            materializedPath: movingUnit.materializedPath,
          },
          newValues: {
            parentOrgUnitId: dto.newParentOrgUnitId,
          },
          affectedNodeCount,
          reason: dto.reason ?? null,
          performedBy: actorUserId,
        },
        qr,
      );

      // 10. Debug integrity verification
      await this.runIntegrityCheckIfDebug(qr);

      if (!isExternalTx) {
        await qr.commitTransaction();
      }

      const updated = await this.orgUnitsRepository.findById(nodeId, qr);
      return updated!;
    } catch (error) {
      if (!isExternalTx) {
        await qr.rollbackTransaction();
      }
      throw error;
    } finally {
      if (!isExternalTx) {
        await qr.release();
      }
    }
  }

  /**
   * §6.2 Recomputes Depth for all nodes in the subtree using transitive depths from closure.
   */
  async recomputeDepthForSubtree(
    nodeId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE u
      SET u.Depth = c.Depth
      FROM org.OrgUnits AS u
      INNER JOIN (
          SELECT cl.DescendantOrgUnitId, MAX(cl.Depth) AS Depth
          FROM org.OrgUnitClosure AS cl
          INNER JOIN org.OrgUnitClosure AS sub
                  ON sub.DescendantOrgUnitId = cl.DescendantOrgUnitId
          WHERE sub.AncestorOrgUnitId = @0
            AND cl.AncestorOrgUnitId IN (SELECT OrgUnitId FROM org.OrgUnits WHERE ParentOrgUnitId IS NULL)
          GROUP BY cl.DescendantOrgUnitId
      ) AS c ON c.DescendantOrgUnitId = u.OrgUnitId;
    `;
    await this.getExecutor(qr).query(sql, [nodeId]);
  }

  /**
   * §6.2 Rebuilds MaterializedPath for the entire subtree using a recursive CTE with unlimited recursion depth.
   */
  async rebuildPathsForSubtree(
    nodeId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      WITH Subtree AS (
          SELECT u.OrgUnitId,
                 u.ParentOrgUnitId,
                 CAST(p.MaterializedPath + REPLACE(CAST(u.OrgUnitId AS VARCHAR(36)), '-', '') + '/' AS VARCHAR(900)) AS NewPath
          FROM org.OrgUnits AS u
          INNER JOIN org.OrgUnits AS p ON p.OrgUnitId = u.ParentOrgUnitId
          WHERE u.OrgUnitId = @0

          UNION ALL

          SELECT c.OrgUnitId,
                 c.ParentOrgUnitId,
                 CAST(s.NewPath + REPLACE(CAST(c.OrgUnitId AS VARCHAR(36)), '-', '') + '/' AS VARCHAR(900))
          FROM org.OrgUnits AS c
          INNER JOIN Subtree AS s ON s.OrgUnitId = c.ParentOrgUnitId
          WHERE c.IsDeleted = 0
      )
      UPDATE u
      SET u.MaterializedPath = s.NewPath
      FROM org.OrgUnits AS u
      INNER JOIN Subtree AS s ON s.OrgUnitId = u.OrgUnitId
      OPTION (MAXRECURSION 0);
    `;
    await this.getExecutor(qr).query(sql, [nodeId]);
  }

  /**
   * §6.3 Integrity Verification.
   * Runs the 4-part union query in debug/test environments and throws if any discrepancies exist.
   */
  async runIntegrityCheckIfDebug(qr?: QueryRunner): Promise<void> {
    const isDebug =
      process.env.NODE_ENV !== 'production' ||
      this.configService.get<boolean>('app.enableTreeIntegrityCheck', false);

    if (!isDebug) return;

    const discrepancies = await this.closureRepository.runIntegrityCheck(qr);
    if (discrepancies.length > 0) {
      this.logger.error(
        `Tree integrity check failed with ${discrepancies.length} discrepancy(ies):`,
        JSON.stringify(discrepancies),
      );
      throw new HttpException(
        {
          code: 'TREE_INTEGRITY_VIOLATION',
          message: `Tree integrity verification failed with ${discrepancies.length} discrepancy(ies).`,
          details: discrepancies,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Public interface for manual integrity check inspection.
   */
  async verifyIntegrity(qr?: QueryRunner): Promise<any[]> {
    return this.closureRepository.runIntegrityCheck(qr);
  }
}
