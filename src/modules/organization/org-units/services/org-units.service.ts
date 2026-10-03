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
import { IOrgUnitType } from '../interfaces/org-unit.interface';
import {
  ORG_UNIT_REFERENCE_CHECKS,
  OrgUnitReferenceCheck,
} from '../interfaces/org-unit-reference-check.interface';
import { ORG_ERROR_CODES } from '../org-units.constants';
import { OrgUnitsMapper } from '../org-units.mapper';
import { OrgUnitChangeLogRepository } from '../repositories/org-unit-change-log.repository';
import { OrgUnitTypesRepository } from '../repositories/org-unit-types.repository';
import { OrgUnitsRepository } from '../repositories/org-units.repository';
import { OrgManagersRepository } from '../../org-managers/repositories/org-managers.repository';
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
    private readonly orgManagersRepository: OrgManagersRepository,
    private readonly mapper: OrgUnitsMapper,
    private readonly auditService: AuditService,
    private readonly orgScopeResolverService: OrgScopeResolverService,
    @Optional()
    @Inject(ORG_UNIT_REFERENCE_CHECKS)
    private readonly referenceChecks: OrgUnitReferenceCheck[] = [],
  ) {}

  private async getBreadcrumbs(
    orgUnitId: number,
  ): Promise<OrgBreadcrumbItemEntity[]> {
    const ancestors = await this.orgUnitsRepository.findAncestors(orgUnitId);
    return ancestors.map((a) => ({
      orgUnitId: a.orgUnitId,
      orgCode: a.orgCode,
      orgName: a.orgName,
    }));
  }

  private async getHeadSummary(
    orgUnitId: number,
  ): Promise<OrgHeadSummaryEntity | null> {
    const currentHead = await this.orgManagersRepository.findCurrentHead(orgUnitId as any);
    if (currentHead) {
      const displayName =
        currentHead.userDisplayName?.trim() || currentHead.username || null;
      return {
        userId: currentHead.userId,
        displayName: displayName || 'Unassigned',
        };
    }
    return null;
  }

  async findAll(
    query: ListOrgUnitsDto,
    currentUserId: string,
  ): Promise<{
    data: OrgUnitEntity[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const [rows, total] = await this.orgUnitsRepository.findAllVisible(
      currentUserId,
      {
        unitTypeId: query.unitTypeId,
        parentId: query.parentId,
        search: query.search,
        isActive: query.isActive,
        offset,
        limit: pageSize,
      },
    );

    const types = await this.typesRepository.findAllTypes();
    const typesMap = new Map<number, IOrgUnitType>(
      types.map((t) => [t.unitTypeId, t]),
    );

    const data = rows.map((r) => {
      const type = typesMap.get(r.unitTypeId)!;
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

  async findTree(currentUserId: string): Promise<OrgUnitTreeItemEntity[]> {
    const [rows, types] = await Promise.all([
      this.orgUnitsRepository.findVisibleTree(currentUserId),
      this.typesRepository.findAllTypes(),
    ]);

    const typesMap = new Map<number, IOrgUnitType>(
      types.map((t) => [t.unitTypeId, t]),
    );
    return this.mapper.toOrgUnitTree(rows, typesMap);
  }

  async findById(
    orgUnitId: number,
    currentUserId: string,
  ): Promise<OrgUnitDetailEntity> {
    const unit = await this.orgUnitsRepository.findByIdVisible(
      orgUnitId,
      currentUserId,
    );
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

  async findDetailById(orgUnitId: number): Promise<OrgUnitDetailEntity> {
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

    const [type, childCount, descendantCount, breadcrumb, head, peopleCount] =
      await Promise.all([
        this.typesRepository.findTypeById(unit.unitTypeId),
        this.orgUnitsRepository.countDirectChildren(orgUnitId),
        this.orgUnitsRepository.countSubtreeDescendants(orgUnitId),
        this.getBreadcrumbs(orgUnitId),
        this.getHeadSummary(orgUnitId),
        this.orgUnitsRepository.countPeople(orgUnitId),
      ]);

    return this.mapper.toOrgUnitDetailEntity(
      unit,
      type!,
      head,
      childCount,
      descendantCount,
      breadcrumb,
      peopleCount,
    );
  }

  async findMembers(
    orgUnitId: number,
    currentUserId: string,
  ): Promise<any[]> {
    const unit = await this.orgUnitsRepository.findByIdVisible(
      orgUnitId,
      currentUserId,
    );
    if (!unit) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.orgUnitsRepository.findMembers(orgUnitId);
  }

  async findChildren(
    orgUnitId: number,
    currentUserId: string,
  ): Promise<OrgUnitEntity[]> {
    const parent = await this.orgUnitsRepository.findByIdVisible(
      orgUnitId,
      currentUserId,
    );
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

    const typesMap = new Map<number, IOrgUnitType>(
      types.map((t) => [t.unitTypeId, t]),
    );
    return children.map((c) =>
      this.mapper.toOrgUnitEntity(c, typesMap.get(c.unitTypeId)!),
    );
  }

  async findAncestors(
    orgUnitId: number,
    currentUserId: string,
  ): Promise<OrgUnitEntity[]> {
    const unit = await this.orgUnitsRepository.findByIdVisible(
      orgUnitId,
      currentUserId,
    );
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

    const typesMap = new Map<number, IOrgUnitType>(
      types.map((t) => [t.unitTypeId, t]),
    );
    return ancestors.map((a) =>
      this.mapper.toOrgUnitEntity(a, typesMap.get(a.unitTypeId)!),
    );
  }

  async findDescendants(
    orgUnitId: number,
    currentUserId: string,
  ): Promise<OrgUnitEntity[]> {
    const unit = await this.orgUnitsRepository.findByIdVisible(
      orgUnitId,
      currentUserId,
    );
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

    const typesMap = new Map<number, IOrgUnitType>(
      types.map((t) => [t.unitTypeId, t]),
    );
    return descendants.map((d) =>
      this.mapper.toOrgUnitEntity(d, typesMap.get(d.unitTypeId)!),
    );
  }

  async getChangeLog(orgUnitId: number, page = 1, pageSize = 20): Promise<any> {
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

  async create(
    dto: CreateOrgUnitDto,
    actorUserId: string,
  ): Promise<OrgUnitDetailEntity> {
    const { parentUnit } = await this.orgUnitValidationService.validateCreate(
      dto,
      actorUserId,
    );

    const created = await this.orgUnitTreeService.createNode(
      dto,
      actorUserId,
      parentUnit,
    );

    await this.auditService.logOrgUnitChange({
      orgUnitId: String(created.orgUnitId),
      operationType: 'INSERT',
      changeCategory: 'STRUCTURE_CHANGE',
      changeReason: `Created org unit [${dto.orgCode}]`,
      actorUserId,
      afterSnapshot: {
        orgCode: dto.orgCode,
        orgName: dto.orgName,
        unitTypeId: dto.unitTypeId,
        parentId: dto.parentId,
      },
    });

    return this.findDetailById(created.orgUnitId);
  }

  async update(
    orgUnitId: number,
    dto: UpdateOrgUnitDto,
    actorUserId: string,
  ): Promise<OrgUnitDetailEntity> {

    if (('parentId' in dto)) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_PARENT_INVALID,
          message:
            'Cannot modify parentId via PATCH /units/:id. Use POST /units/:id/move for reparenting.',
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

    if (dto.orgCode && dto.orgCode !== existing.orgCode) {
      this.orgUnitValidationService.validateC8_CodeFormat(dto.orgCode);
      await this.orgUnitValidationService.validateC7_CodeUniqueAmongSiblings(
        existing.parentId,
        dto.orgCode,
      );
    }

    const updated = await this.orgUnitsRepository.update(orgUnitId, dto);

    await this.changeLogRepository.create({
      orgUnitId,
      changeType: 'UPDATED',
      oldValues: {
        orgCode: existing.orgCode,
        orgName: existing.orgName,
      },
      newValues: dto,
      reason: 'Attribute update',
      performedBy: actorUserId,
    });

    await this.auditService.logOrgUnitChange({
      orgUnitId: String(orgUnitId),
      operationType: 'UPDATE',
      changeCategory: 'STRUCTURE_CHANGE',
      changeReason: 'Updated org unit attributes',
      actorUserId,
      beforeSnapshot: existing,
      afterSnapshot: updated,
    });

    return this.findDetailById(orgUnitId);
  }

  async move(
    orgUnitId: number,
    dto: MoveOrgUnitDto,
    actorUserId: string,
  ): Promise<OrgUnitDetailEntity> {
    await this.orgUnitValidationService.validateMove(
      orgUnitId,
      dto,
      actorUserId,
    );

    const moved = await this.orgUnitTreeService.moveSubtree(
      orgUnitId,
      dto,
      actorUserId,
    );

    await this.auditService.logOrgUnitChange({
      orgUnitId: String(orgUnitId),
      operationType: 'MOVE',
      changeCategory: 'STRUCTURE_CHANGE',
      changeReason: dto.reason ?? 'Reorganization move',
      actorUserId,
      afterSnapshot: {
        newParentId: dto.newParentId,
      },
    });

    return this.findDetailById(orgUnitId);
  }

  async activate(
    orgUnitId: number,
    actorUserId: string,
  ): Promise<OrgUnitDetailEntity> {
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

    await this.orgUnitsRepository.setActiveStatus(
      orgUnitId,
      true,
      null,
      actorUserId,
    );

    await this.changeLogRepository.create({
      orgUnitId,
      changeType: 'ACTIVATED',
      reason: 'Unit activated',
      performedBy: actorUserId,
    });

    await this.auditService.logOrgUnitChange({
      orgUnitId: String(orgUnitId),
      operationType: 'UPDATE',
      changeCategory: 'LIFECYCLE_CHANGE',
      changeReason: 'Unit activated',
      actorUserId,
    });

    return this.findDetailById(orgUnitId);
  }

  async deactivate(
    orgUnitId: number,
    actorUserId: string,
  ): Promise<OrgUnitDetailEntity> {
    const existing = await this.orgUnitValidationService.validateDeactivate(orgUnitId);

    const effectiveTo = new Date().toISOString().split('T')[0];
    await this.orgUnitsRepository.setActiveStatus(
      orgUnitId,
      false,
      effectiveTo,
      actorUserId,
    );

    await this.changeLogRepository.create({
      orgUnitId,
      changeType: 'DEACTIVATED',
      reason: 'Unit deactivated',
      performedBy: actorUserId,
    });

    await this.auditService.logOrgUnitChange({
      orgUnitId: String(orgUnitId),
      operationType: 'UPDATE',
      changeCategory: 'LIFECYCLE_CHANGE',
      changeReason: 'Unit deactivated',
      actorUserId,
    });

    return this.findDetailById(orgUnitId);
  }

  async softDelete(orgUnitId: number, actorUserId: string): Promise<void> {
    await this.orgUnitValidationService.validateDelete(orgUnitId);
    await this.orgUnitsRepository.softDelete(orgUnitId, actorUserId);

    await this.changeLogRepository.create({
      orgUnitId,
      changeType: 'DELETED',
      reason: 'Unit soft deleted',
      performedBy: actorUserId,
    });

    await this.auditService.logOrgUnitChange({
      orgUnitId: String(orgUnitId),
      operationType: 'SOFT_DELETE',
      changeCategory: 'LIFECYCLE_CHANGE',
      changeReason: 'Unit deleted',
      actorUserId,
    });
  }

  async getApprovalChain(orgUnitId: number): Promise<any[]> {
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
      orgCode: u.orgCode,
      orgName: u.orgName,
    }));
  }

  async getBudgetOwner(orgUnitId: number): Promise<OrgUnitEntity | null> {
    const owner = await this.orgUnitsRepository.findBudgetOwner(orgUnitId);
    if (!owner) return null;
    const type = await this.typesRepository.findTypeById(owner.unitTypeId);
    return this.mapper.toOrgUnitEntity(owner, type!);
  }

  async getMyVisibleUnits(currentUserId: string): Promise<any[]> {
    return this.orgScopeResolverService.getVisibleOrgUnits(currentUserId);
  }

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

    const rows = await this.orgUnitsRepository.findForExport(
      currentUserId,
      query,
    );

    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Organization Units');
    sheet.columns = [
      { header: 'Code', key: 'orgCode', width: 18 },
      { header: 'Name', key: 'orgName', width: 32 },
      { header: 'Type', key: 'typeName', width: 22 },
      { header: 'Parent Code', key: 'parentCode', width: 18 },
      { header: 'Parent Name', key: 'parentName', width: 32 },
      { header: 'Cost Centre', key: 'costCenterCode', width: 16 },
      { header: 'Active', key: 'activeStatus', width: 12 },
    ];

    rows.forEach((r) => {
      sheet.addRow({
        orgCode: r.orgCode,
        orgName: r.orgName,
        typeName: r.typeName,
        parentCode: r.parentCode || '',
        parentName: r.parentName || '',
        costCenterCode: r.costCenterCode || '',
        activeStatus: r.isActive ? 'Yes' : 'No',
      });
    });


    await this.auditService.logOrgUnitChange({
      orgUnitId: null as any,
      operationType: 'EXPORT',
      changeCategory: 'DATA_EXPORT',
      changeReason: `Exported ${totalRows} organization units to Excel`,
      actorUserId: currentUserId,
      afterSnapshot: {
        totalRows,
        filters: query,
        format: 'EXCEL',
        isQueued: false,
      },
    });

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    return {
      queued: false,
      totalRows,
      buffer,
      filename: `OrganizationUnits_Export_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`,
    };
  }
}
