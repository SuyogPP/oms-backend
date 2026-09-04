import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../../../audit/service/audit.services';
import {
  ORG_ERROR_CODES,
  ORG_MANAGER_ROLES,
} from '../../org-units/org-units.constants';
import { OrgUnitChangeLogRepository } from '../../org-units/repositories/org-unit-change-log.repository';
import { OrgUnitsRepository } from '../../org-units/repositories/org-units.repository';
import { OrgUnitValidationService } from '../../org-units/services/org-unit-validation.service';
import { AssignManagerDto } from '../dto/assign-manager.dto';
import { UpdateManagerDto } from '../dto/update-manager.dto';
import { OrgManagerEntity } from '../entities/org-manager.entity';
import { OrgManagersMapper } from '../org-managers.mapper';
import { OrgManagersRepository } from '../repositories/org-managers.repository';

@Injectable()
export class OrgManagersService {
  private readonly logger = new Logger(OrgManagersService.name);

  constructor(
    private readonly managersRepository: OrgManagersRepository,
    private readonly orgUnitsRepository: OrgUnitsRepository,
    private readonly validationService: OrgUnitValidationService,
    private readonly changeLogRepository: OrgUnitChangeLogRepository,
    private readonly mapper: OrgManagersMapper,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Retrieves all manager assignment history for an organization unit.
   */
  async findByUnitId(orgUnitId: string): Promise<OrgManagerEntity[]> {
    const rows = await this.managersRepository.findByUnitId(orgUnitId);
    return this.mapper.toEntities(rows);
  }

  /**
   * Retrieves current active primary HEAD manager for an organization unit.
   */
  async findCurrentHead(
    orgUnitId: string,
    asOfDate?: string,
  ): Promise<OrgManagerEntity | null> {
    const row = await this.managersRepository.findCurrentHead(
      orgUnitId,
      asOfDate,
    );
    return row ? this.mapper.toEntity(row) : null;
  }

  /**
   * Retrieves all units managed by a specific user.
   */
  async findByUserId(userId: string): Promise<OrgManagerEntity[]> {
    const rows = await this.managersRepository.findByUserId(userId);
    return this.mapper.toEntities(rows);
  }

  /**
   * Assigns a manager to an organization unit.
   * Enforces rules G1 through G6 in a single atomic transaction.
   */
  async assignManager(
    orgUnitId: string,
    dto: AssignManagerDto,
    actorUserId: string,
  ): Promise<OrgManagerEntity> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 1. Validate rules G3, G4, G5
      await this.validationService.validateAssignManager(orgUnitId, dto, qr);

      const isPrimaryHead =
        dto.managerRoleCode === ORG_MANAGER_ROLES.HEAD &&
        Boolean(dto.isPrimary);

      // 2. Rule G2: If assigning primary HEAD, auto-end previous primary HEAD in the same transaction
      if (isPrimaryHead) {
        await this.managersRepository.endPreviousPrimaryHead(
          orgUnitId,
          dto.effectiveFrom,
          actorUserId,
          qr,
        );
      }

      // 3. Create manager record
      const created = await this.managersRepository.create(
        {
          orgUnitId,
          userId: dto.userId,
          managerRoleCode: dto.managerRoleCode,
          isPrimary: Boolean(dto.isPrimary),
          effectiveFrom: dto.effectiveFrom,
          effectiveTo: dto.effectiveTo ?? null,
          assignmentReason: dto.assignmentReason ?? null,
        },
        actorUserId,
        qr,
      );

      // 4. Rule G6: Refresh org.OrgUnits.HeadUserId in the same transaction if primary HEAD assigned
      if (isPrimaryHead) {
        await this.orgUnitsRepository.updateHeadUser(
          orgUnitId,
          dto.userId,
          actorUserId,
          qr,
        );
      }

      // 5. Write change log entry
      await this.changeLogRepository.create(
        {
          orgUnitId,
          changeType: 'MANAGER_ASSIGNED',
          newValues: {
            managerId: created.orgUnitManagerId,
            userId: dto.userId,
            role: dto.managerRoleCode,
            isPrimary: dto.isPrimary,
            effectiveFrom: dto.effectiveFrom,
          },
          affectedNodeCount: 1,
          reason: dto.assignmentReason ?? 'Manager assigned',
          performedBy: actorUserId,
        },
        qr,
      );

      // 6. Emit audit event
      await this.auditService.logOrgUnitChange({
        orgUnitId,
        operationType: 'INSERT',
        changeCategory: 'MANAGER_CHANGE',
        changeReason: `Assigned manager [${dto.managerRoleCode}]`,
        actorUserId,
        afterSnapshot: created,
      });

      await qr.commitTransaction();

      const fullRecord = await this.managersRepository.findById(
        created.orgUnitManagerId,
      );
      return this.mapper.toEntity(fullRecord!);
    } catch (error: any) {
      console.error(
        '[assignManager error]:',
        error?.message,
        error?.stack || error,
      );
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw error;
    } finally {
      await qr.release();
    }
  }

  /**
   * Updates an existing manager assignment tenure or reason.
   */
  async updateManager(
    managerId: string,
    dto: UpdateManagerDto,
    actorUserId: string,
  ): Promise<OrgManagerEntity> {
    const existing = await this.managersRepository.findById(managerId);
    if (!existing) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Manager assignment [${managerId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const becomingPrimaryHead =
        existing.managerRoleCode === ORG_MANAGER_ROLES.HEAD &&
        dto.isPrimary === true &&
        !existing.isPrimary;

      // Rule G2: If promoting to primary HEAD, auto-end previous primary HEAD
      if (becomingPrimaryHead) {
        const today = new Date().toISOString().split('T')[0];
        await this.managersRepository.endPreviousPrimaryHead(
          existing.orgUnitId,
          today,
          actorUserId,
          qr,
        );
      }

      const updated = await this.managersRepository.update(
        managerId,
        dto,
        actorUserId,
        qr,
      );

      // Rule G6: Refresh HeadUserId if primary status changed
      if (becomingPrimaryHead) {
        await this.orgUnitsRepository.updateHeadUser(
          existing.orgUnitId,
          existing.userId,
          actorUserId,
          qr,
        );
      } else if (dto.isPrimary === false && existing.isPrimary) {
        // Demoted from primary: refresh current head or clear
        const currentHead = await this.managersRepository.findCurrentHead(
          existing.orgUnitId,
          undefined,
          qr,
        );
        await this.orgUnitsRepository.updateHeadUser(
          existing.orgUnitId,
          currentHead?.userId ?? null,
          actorUserId,
          qr,
        );
      }

      await this.changeLogRepository.create(
        {
          orgUnitId: existing.orgUnitId,
          changeType: 'MANAGER_UPDATED',
          oldValues: existing,
          newValues: dto,
          affectedNodeCount: 1,
          reason: dto.assignmentReason ?? 'Manager details updated',
          performedBy: actorUserId,
        },
        qr,
      );

      await this.auditService.logOrgUnitChange({
        orgUnitId: existing.orgUnitId,
        operationType: 'UPDATE',
        changeCategory: 'MANAGER_CHANGE',
        changeReason: 'Updated manager assignment details',
        actorUserId,
        beforeSnapshot: existing,
        afterSnapshot: updated,
      });

      await qr.commitTransaction();

      const fullRecord = await this.managersRepository.findById(managerId);
      return this.mapper.toEntity(fullRecord!);
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  /**
   * Removes / ends a manager assignment.
   */
  async removeManager(managerId: string, actorUserId: string): Promise<void> {
    const existing = await this.managersRepository.findById(managerId);
    if (!existing) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Manager assignment [${managerId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await this.managersRepository.softDelete(managerId, actorUserId, qr);

      // Rule G6: Refresh HeadUserId on OrgUnits if the removed manager was primary
      if (
        existing.isPrimary &&
        existing.managerRoleCode === ORG_MANAGER_ROLES.HEAD
      ) {
        const currentHead = await this.managersRepository.findCurrentHead(
          existing.orgUnitId,
          undefined,
          qr,
        );
        await this.orgUnitsRepository.updateHeadUser(
          existing.orgUnitId,
          currentHead?.userId ?? null,
          actorUserId,
          qr,
        );
      }

      await this.changeLogRepository.create(
        {
          orgUnitId: existing.orgUnitId,
          changeType: 'MANAGER_REMOVED',
          oldValues: existing,
          affectedNodeCount: 1,
          reason: 'Manager removed',
          performedBy: actorUserId,
        },
        qr,
      );

      await this.auditService.logOrgUnitChange({
        orgUnitId: existing.orgUnitId,
        operationType: 'SOFT_DELETE',
        changeCategory: 'MANAGER_CHANGE',
        changeReason: 'Removed manager assignment',
        actorUserId,
      });

      await qr.commitTransaction();
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  /**
   * §8.4 / Rule G7: Hierarchical approval chain resolution.
   * Walks ancestors from node to root using closure table, joining current active primary HEAD
   * manager at each level with effective-date filtering.
   *
   * JSDOC IMPORTANT: Domain 5 (Requisition & Approval Workflow) strictly depends on this method
   * and its query contract. Its contract must not change without cross-domain coordination.
   */
  async getApprovalChain(orgUnitId: string): Promise<any[]> {
    return this.managersRepository.getApprovalChain(orgUnitId);
  }
}
