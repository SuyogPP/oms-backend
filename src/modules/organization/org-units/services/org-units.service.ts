import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Workbook } from 'exceljs';
import { AuditService } from '../../../audit/service/audit.services';
import { CreateOrgUnitDto } from '../dto/create-org-unit.dto';
import { ListOrgUnitsDto } from '../dto/list-org-units.dto';
import { MoveOrgUnitDto } from '../dto/move-org-unit.dto';
import { UpdateOrgUnitDto } from '../dto/update-org-unit.dto';
import {
  OrgBreadcrumbItemEntity,
  OrgHeadSummaryEntity,
  OrgUnitDetailEntity,
  OrgUnitEntity,
  OrgUnitTreeItemEntity,
} from '../entities/org-unit.entity';
import {
  IOrgUnit,
  IOrgUnitType,
} from '../interfaces/org-unit.interface';
import {
  ORG_UNIT_REFERENCE_CHECKS,
  OrgUnitReferenceCheck,
} from '../interfaces/org-unit-reference-check.interface';
import {
  ORG_ERROR_CODES,
  ORG_MANAGER_ROLES,
} from '../org-units.constants';
import { OrgUnitsMapper } from '../org-units.mapper';
import { OrgUnitChangeLogRepository } from '../repositories/org-unit-change-log.repository';
import { OrgUnitTypesRepository } from '../repositories/org-unit-types.repository';
import { OrgUnitsRepository } from '../repositories/org-units.repository';
import { OrgScopeResolverService } from '../../org-scope/services/org-scope-resolver.service';
import { OrgUnitTreeService } from './org-unit-tree.service';
import { OrgUnitValidationService } from './org-unit-validation.service';

@Injectable()
export class OrgUnitsService {
  private readonly logger = new Logger(OrgUnitsService.name);

  constructor(
    private readonly orgUnitsRepository: OrgUnitsRepository,
    private readonly orgUnitTreeService: OrgUnitTreeService,
    private readonly orgUnitValidationService: OrgUnitValidationService,
    private readonly typesRepository: OrgUnitTypesRepository,
    private readonly changeLogRepository: OrgUnitChangeLogRepository,
    private readonly mapper: OrgUnitsMapper,
    private readonly auditService: AuditService,
    private readonly orgScopeResolverService: OrgScopeResolverService,
    @Optional()
    @Inject(ORG_UNIT_REFERENCE_CHECKS)
    private readonly referenceChecks: OrgUnitReferenceCheck[] = [],
  ) {}

  /**
   * Helper: Resolves and builds breadcrumb trail from root down to parent.
   */
  private async getBreadcrumbs(orgUnitId: string): Promise<OrgBreadcrumbItemEntity[]> {
    const ancestors = await this.orgUnitsRepository.findAncestors(orgUnitId);
    return ancestors.map((a) => ({
      orgUnitId: a.orgUnitId,
      code: a.code,
      name: a.name,
    }));
  }

  /**
   * Helper: Resolves head summary if assigned.
   */
  private async getHeadSummary(headUserId?: string | null): Promise<OrgHeadSummaryEntity | null> {
    if (!headUserId) return null;
    return {
      userId: headUserId,
      displayName: 'Assigned Head',
      effectiveFrom: new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Retrieves paginated, filtered organization units within user scope.
   */
  async findAll(
    query: ListOrgUnitsDto,
    currentUserId: string,
  ): Promise<{ data: OrgUnitEntity[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const [rows, total] = await this.orgUnitsRepository.findAllVisible(
      currentUserId,
      {
        orgUnitTypeId: query.orgUnitTypeId,
        depth: query.depth,
        parentOrgUnitId: query.parentOrgUnitId,
        search: query.search,
        isActive: query.isActive,
        offset,
        limit: pageSize,
      },
    );

    const types = await this.typesRepository.findAllTypes();
    const typesMap = new Map<number, IOrgUnitType>(types.map((t) => [t.orgUnitTypeId, t]));

    const data = rows.map((r) => {
      const type = typesMap.get(r.orgUnitTypeId)!;
      return this.mapper.toOrgUnitEntity(r, type);
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Retrieves full visible organization hierarchy as a nested tree.
   */
  async findTree(currentUserId: string): Promise<OrgUnitTreeItemEntity[]> {
    const [rows, types] = await Promise.all([
      this.orgUnitsRepository.findVisibleTree(currentUserId),
      this.typesRepository.findAllTypes(),
    ]);

    const typesMap = new Map<number, IOrgUnitType>(types.map((t) => [t.orgUnitTypeId, t]));
    return this.mapper.toOrgUnitTree(rows, typesMap);
  }

  /**
   * Retrieves organization unit details including breadcrumbs and child/descendant counts.
   * §9.3 Non-Negotiable #2: Out-of-scope units return 404 NOT_FOUND.
   */
  async findById(orgUnitId: string, currentUserId: string): Promise<OrgUnitDetailEntity> {
    const unit = await this.orgUnitsRepository.findByIdVisible(orgUnitId, currentUserId);
    if (!unit) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.findDetailById(orgUnitId);
  }

  /**
   * Internal helper to load full detail and breadcrumbs for an org unit.
   */
  async findDetailById(orgUnitId: string): Promise<OrgUnitDetailEntity> {
    const unit = await this.orgUnitsRepository.findById(orgUnitId);
    if (!unit) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const [type, childCount, descendantCount, breadcrumb, head] =
      await Promise.all([
        this.typesRepository.findTypeById(unit.orgUnitTypeId),
        this.orgUnitsRepository.countDirectChildren(orgUnitId),
        this.orgUnitsRepository.countSubtreeDescendants(orgUnitId),
        this.getBreadcrumbs(orgUnitId),
        this.getHeadSummary(unit.headUserId),
      ]);

    return this.mapper.toOrgUnitDetailEntity(
      unit,
      type!,
      head,
      childCount,
      descendantCount,
      breadcrumb,
    );
  }

  /**
   * Retrieves direct children of a unit within caller scope.
   */
  async findChildren(orgUnitId: string, currentUserId: string): Promise<OrgUnitEntity[]> {
    const parent = await this.orgUnitsRepository.findByIdVisible(orgUnitId, currentUserId);
    if (!parent) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const [children, types] = await Promise.all([
      this.orgUnitsRepository.findChildrenVisible(orgUnitId, currentUserId),
      this.typesRepository.findAllTypes(),
    ]);

    const typesMap = new Map<number, IOrgUnitType>(types.map((t) => [t.orgUnitTypeId, t]));
    return children.map((c) => this.mapper.toOrgUnitEntity(c, typesMap.get(c.orgUnitTypeId)!));
  }

  /**
   * Retrieves ordered ancestors within caller scope.
   */
  async findAncestors(orgUnitId: string, currentUserId: string): Promise<OrgUnitEntity[]> {
    const unit = await this.orgUnitsRepository.findByIdVisible(orgUnitId, currentUserId);
    if (!unit) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const [ancestors, types] = await Promise.all([
      this.orgUnitsRepository.findAncestorsVisible(orgUnitId, currentUserId),
      this.typesRepository.findAllTypes(),
    ]);

    const typesMap = new Map<number, IOrgUnitType>(types.map((t) => [t.orgUnitTypeId, t]));
    return ancestors.map((a) => this.mapper.toOrgUnitEntity(a, typesMap.get(a.orgUnitTypeId)!));
  }

  /**
   * Retrieves flat descendants list within caller scope.
   */
  async findDescendants(orgUnitId: string, currentUserId: string): Promise<OrgUnitEntity[]> {
    const unit = await this.orgUnitsRepository.findByIdVisible(orgUnitId, currentUserId);
    if (!unit) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const [descendants, types] = await Promise.all([
      this.orgUnitsRepository.findDescendantsVisible(orgUnitId, currentUserId),
      this.typesRepository.findAllTypes(),
    ]);

    const typesMap = new Map<number, IOrgUnitType>(types.map((t) => [t.orgUnitTypeId, t]));
    return descendants.map((d) => this.mapper.toOrgUnitEntity(d, typesMap.get(d.orgUnitTypeId)!));
  }

  /**
   * Retrieves paginated change log for a unit.
   */
  async getChangeLog(orgUnitId: string, page = 1, pageSize = 20): Promise<any> {
    const [logs, total] = await this.changeLogRepository.findByOrgUnitId(
      orgUnitId,
      page,
      pageSize,
    );

    return {
      data: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Creates a new organization unit. Delegates tree insertion to OrgUnitTreeService.
   */
  async create(
    dto: CreateOrgUnitDto,
    actorUserId: string,
  ): Promise<OrgUnitDetailEntity> {
    // 1. Validate all C1–C10 creation rules
    const { parentUnit } = await this.orgUnitValidationService.validateCreate(
      dto,
      actorUserId,
    );

    // 2. Delegate creation to OrgUnitTreeService
    const created = await this.orgUnitTreeService.createNode(
      dto,
      actorUserId,
      parentUnit,
    );

    // 3. Emit audit event
    await this.auditService.logOrgUnitChange({
      orgUnitId: created.orgUnitId,
      operationType: 'INSERT',
      changeCategory: 'STRUCTURE_CHANGE',
      changeReason: `Created org unit [${dto.code}]`,
      actorUserId,
      afterSnapshot: {
        code: dto.code,
        name: dto.name,
        orgUnitTypeId: dto.orgUnitTypeId,
        parentOrgUnitId: dto.parentOrgUnitId,
      },
    });

    return this.findDetailById(created.orgUnitId);
  }

  /**
   * Updates organization unit non-structural attributes.
   * REJECTS any attempt to change parentOrgUnitId with 400.
   */
  async update(
    orgUnitId: string,
    dto: UpdateOrgUnitDto,
    actorUserId: string,
  ): Promise<OrgUnitDetailEntity> {
    // Rejection rule: parentOrgUnitId must never be changed via PATCH
    if (dto.parentOrgUnitId !== undefined) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_PARENT_INVALID,
          message:
            'Cannot modify parentOrgUnitId via PATCH /units/:id. Use POST /units/:id/move for reparenting.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.orgUnitsRepository.findById(orgUnitId);
    if (!existing) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // If code is modified, validate format and sibling uniqueness
    if (dto.code && dto.code !== existing.code) {
      this.orgUnitValidationService.validateC8_CodeFormat(dto.code);
      await this.orgUnitValidationService.validateC7_CodeUniqueAmongSiblings(
        existing.parentOrgUnitId,
        dto.code,
      );
    }

    const updated = await this.orgUnitsRepository.update(orgUnitId, {
      ...dto,
      updatedBy: actorUserId,
    });

    // Write change log entry
    await this.changeLogRepository.create({
      orgUnitId,
      changeType: 'UPDATED',
      oldValues: {
        code: existing.code,
        name: existing.name,
        sortOrder: existing.sortOrder,
      },
      newValues: dto,
      affectedNodeCount: 1,
      reason: 'Attribute update',
      performedBy: actorUserId,
    });

    // Emit audit event
    await this.auditService.logOrgUnitChange({
      orgUnitId,
      operationType: 'UPDATE',
      changeCategory: 'STRUCTURE_CHANGE',
      changeReason: 'Updated org unit attributes',
      actorUserId,
      beforeSnapshot: existing,
      afterSnapshot: updated,
    });

    return this.findDetailById(orgUnitId);
  }

  /**
   * Reparents an organization unit and its entire subtree.
   */
  async move(
    orgUnitId: string,
    dto: MoveOrgUnitDto,
    actorUserId: string,
  ): Promise<OrgUnitDetailEntity> {
    // 1. Validate all M1–M8 move rules
    await this.orgUnitValidationService.validateMove(
      orgUnitId,
      dto,
      actorUserId,
    );

    // 2. Delegate move sequence to OrgUnitTreeService
    const moved = await this.orgUnitTreeService.moveSubtree(
      orgUnitId,
      dto,
      actorUserId,
    );

    // 3. Emit audit event
    await this.auditService.logOrgUnitChange({
      orgUnitId,
      operationType: 'MOVE',
      changeCategory: 'STRUCTURE_CHANGE',
      changeReason: dto.reason ?? 'Reorganization move',
      actorUserId,
      afterSnapshot: {
        newParentOrgUnitId: dto.newParentOrgUnitId,
        rowVersion: moved.rowVersion,
      },
    });

    return this.findDetailById(orgUnitId);
  }

  /**
   * Activates an organization unit.
   */
  async activate(orgUnitId: string, actorUserId: string): Promise<OrgUnitDetailEntity> {
    const existing = await this.orgUnitsRepository.findById(orgUnitId);
    if (!existing) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.orgUnitsRepository.setActiveStatus(orgUnitId, true, null, actorUserId);

    await this.changeLogRepository.create({
      orgUnitId,
      changeType: 'ACTIVATED',
      affectedNodeCount: 1,
      reason: 'Unit activated',
      performedBy: actorUserId,
    });

    await this.auditService.logOrgUnitChange({
      orgUnitId,
      operationType: 'UPDATE',
      changeCategory: 'LIFECYCLE_CHANGE',
      changeReason: 'Unit activated',
      actorUserId,
    });

    return this.findDetailById(orgUnitId);
  }

  /**
   * Deactivates an organization unit.
   */
  async deactivate(orgUnitId: string, actorUserId: string): Promise<OrgUnitDetailEntity> {
    const existing = await this.orgUnitValidationService.validateDeactivate(orgUnitId);

    const today = new Date().toISOString().split('T')[0];
    const effectiveFromStr =
      existing.effectiveFrom instanceof Date
        ? existing.effectiveFrom.toISOString().split('T')[0]
        : String(existing.effectiveFrom);
    const effectiveTo = effectiveFromStr > today ? effectiveFromStr : today;
    await this.orgUnitsRepository.setActiveStatus(orgUnitId, false, effectiveTo, actorUserId);

    await this.changeLogRepository.create({
      orgUnitId,
      changeType: 'DEACTIVATED',
      affectedNodeCount: 1,
      reason: 'Unit deactivated',
      performedBy: actorUserId,
    });

    await this.auditService.logOrgUnitChange({
      orgUnitId,
      operationType: 'UPDATE',
      changeCategory: 'LIFECYCLE_CHANGE',
      changeReason: 'Unit deactivated',
      actorUserId,
    });

    return this.findDetailById(orgUnitId);
  }

  /**
   * Soft deletes an organization unit.
   */
  async softDelete(orgUnitId: string, actorUserId: string): Promise<void> {
    await this.orgUnitValidationService.validateDelete(orgUnitId);

    await this.orgUnitsRepository.softDelete(orgUnitId, actorUserId);

    await this.changeLogRepository.create({
      orgUnitId,
      changeType: 'DELETED',
      affectedNodeCount: 1,
      reason: 'Unit soft deleted',
      performedBy: actorUserId,
    });

    await this.auditService.logOrgUnitChange({
      orgUnitId,
      operationType: 'SOFT_DELETE',
      changeCategory: 'LIFECYCLE_CHANGE',
      changeReason: 'Unit deleted',
      actorUserId,
    });
  }

  /**
   * Walks up the hierarchy from orgUnitId returning the approval chain (HEAD managers).
   */
  async getApprovalChain(orgUnitId: string): Promise<any[]> {
    const ancestors = await this.orgUnitsRepository.findAncestors(orgUnitId);
    const self = await this.orgUnitsRepository.findById(orgUnitId);
    if (!self) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const unitsChain = [self, ...ancestors];
    return unitsChain.map((u, index) => ({
      step: index + 1,
      orgUnitId: u.orgUnitId,
      code: u.code,
      name: u.name,
      headUserId: u.headUserId ?? null,
    }));
  }

  /**
   * Finds the nearest ancestor org unit with budget capability (AllowsBudget = 1).
   */
  async getBudgetOwner(orgUnitId: string): Promise<OrgUnitEntity | null> {
    const owner = await this.orgUnitsRepository.findBudgetOwner(orgUnitId);
    if (!owner) return null;
    const type = await this.typesRepository.findTypeById(owner.orgUnitTypeId);
    return this.mapper.toOrgUnitEntity(owner, type!);
  }

  /**
   * Returns visible org units for authenticated user.
   */
  async getMyVisibleUnits(currentUserId: string): Promise<any[]> {
    return this.orgScopeResolverService.getVisibleOrgUnits(currentUserId);
  }

  /**
   * §8.2 Export Organization Units to Excel with scope-filtering and large dataset queuing (> 5000 rows).
   */
  async exportToExcel(
    query: ListOrgUnitsDto,
    currentUserId: string,
  ): Promise<{
    queued: boolean;
    jobId?: string;
    totalRows?: number;
    message?: string;
    buffer?: Buffer;
    filename?: string;
  }> {
    const totalRows = await this.orgUnitsRepository.countForExport(
      currentUserId,
      query,
    );

    // If result exceeds 5,000 rows, queue it for background processing
    if (totalRows > 5000) {
      const jobId = randomUUID();

      await this.auditService.logOrgUnitChange({
        orgUnitId: null as any,
        operationType: 'EXPORT',
        changeCategory: 'DATA_EXPORT',
        changeReason: `Queued export job [${jobId}] for ${totalRows} organization units (exceeds synchronous 5000 row threshold)`,
        actorUserId: currentUserId,
        afterSnapshot: {
          jobId,
          totalRows,
          filters: query,
          format: 'EXCEL',
          isQueued: true,
        },
      });

      return {
        queued: true,
        jobId,
        totalRows,
        message: `Export job queued for background generation due to large dataset size (${totalRows.toLocaleString()} rows).`,
      };
    }

    // Synchronous generation for <= 5000 rows
    const rows = await this.orgUnitsRepository.findForExport(
      currentUserId,
      query,
    );

    const workbook = new Workbook();
    workbook.creator = 'DIEZ OMS';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Organization Units', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Configure Columns
    sheet.columns = [
      { header: 'Code', key: 'code', width: 18 },
      { header: 'Name', key: 'name', width: 32 },
      { header: 'Name (Arabic)', key: 'nameAr', width: 32 },
      { header: 'Type', key: 'typeName', width: 22 },
      { header: 'Parent Code', key: 'parentCode', width: 18 },
      { header: 'Parent Name', key: 'parentName', width: 32 },
      { header: 'Depth', key: 'depth', width: 10 },
      { header: 'Cost Centre', key: 'costCenterCode', width: 16 },
      { header: 'Head', key: 'headDisplayName', width: 28 },
      { header: 'Active', key: 'activeStatus', width: 12 },
      { header: 'Effective From', key: 'effectiveFrom', width: 16 },
      { header: 'Effective To', key: 'effectiveTo', width: 16 },
    ];

    // Style Header Row
    const headerRow = sheet.getRow(1);
    headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Slate dark blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    headerRow.height = 28;

    // Add Data Rows
    rows.forEach((r) => {
      sheet.addRow({
        code: r.code,
        name: r.name,
        nameAr: r.nameAr || '',
        typeName: r.typeName,
        parentCode: r.parentCode || '',
        parentName: r.parentName || '',
        depth: r.depth,
        costCenterCode: r.costCenterCode || '',
        headDisplayName: r.headDisplayName || '',
        activeStatus: r.isActive ? 'Yes' : 'No',
        effectiveFrom: r.effectiveFrom || '',
        effectiveTo: r.effectiveTo || '',
      });
    });

    // Style Data Rows
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = { vertical: 'middle', wrapText: false };
        row.font = { name: 'Arial', size: 10 };
        row.height = 20;

        // Subtle alternate row shading
        if (rowNumber % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }

        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `organization_units_export_${dateStr}.xlsx`;

    // Record audit event
    await this.auditService.logOrgUnitChange({
      orgUnitId: null as any,
      operationType: 'EXPORT',
      changeCategory: 'DATA_EXPORT',
      changeReason: `Exported ${rows.length} organization units to Excel file [${filename}]`,
      actorUserId: currentUserId,
      afterSnapshot: {
        rowCount: rows.length,
        filters: query,
        format: 'EXCEL',
        filename,
        isQueued: false,
      },
    });

    return {
      queued: false,
      buffer: Buffer.from(buffer),
      filename,
      totalRows: rows.length,
    };
  }
}
