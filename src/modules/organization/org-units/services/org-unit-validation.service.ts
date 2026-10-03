import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AssignManagerDto } from '../../org-managers/dto/assign-manager.dto';
import { CreateOrgUnitDto } from '../dto/create-org-unit.dto';
import { MoveOrgUnitDto } from '../dto/move-org-unit.dto';
import { IOrgUnit, IOrgUnitType } from '../interfaces/org-unit.interface';
import {
  ORG_UNIT_REFERENCE_CHECKS,
  OrgUnitReferenceCheck,
} from '../interfaces/org-unit-reference-check.interface';
import {
  ORG_CODE_REGEX,
  ORG_ERROR_CODES,
  ORG_MANAGER_ROLES,
} from '../org-units.constants';
import { OrgUnitTypesRepository } from '../repositories/org-unit-types.repository';
import { OrgUnitsRepository } from '../repositories/org-units.repository';

@Injectable()
export class OrgUnitValidationService {
  constructor(
    private readonly orgUnitsRepository: OrgUnitsRepository,
    private readonly typesRepository: OrgUnitTypesRepository,
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(ORG_UNIT_REFERENCE_CHECKS)
    private readonly referenceChecks: OrgUnitReferenceCheck[] = [],
  ) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  async validateC1_TypeExistsAndActive(
    unitTypeId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnitType> {
    const unitType = await this.typesRepository.findTypeById(unitTypeId, qr);
    if (!unitType || !unitType.isActive) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_TYPE_INVALID,
          message: `unitTypeId [${unitTypeId}] is invalid, inactive, or does not exist.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return unitType;
  }

  validateC2_ParentRequiredForNonRoot(
    isRootType: boolean,
    parentId?: number | null,
  ): void {
    if (!isRootType && (!parentId)) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_PARENT_REQUIRED,
          message:
            'A parent organization unit is required for non-root unit types.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  validateC3_RootCannotHaveParent(
    isRootType: boolean,
    parentId?: number | null,
  ): void {
    if (isRootType && parentId) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_ROOT_CANNOT_HAVE_PARENT,
          message: 'Root organization types cannot be assigned a parent unit.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async validateC4_SingleActiveRoot(
    isRootType: boolean,
    qr?: QueryRunner,
  ): Promise<void> {
    if (isRootType) {
      const existingRoot = await this.orgUnitsRepository.findActiveRoot(qr);
      if (existingRoot) {
        throw new HttpException(
          {
            code: ORG_ERROR_CODES.ORG_ROOT_EXISTS,
            message: `An active root organization already exists with Code [${existingRoot.orgCode}].`,
          },
          HttpStatus.CONFLICT,
        );
      }
    }
  }

  async validateC5_HierarchyRule(
    childTypeId: number,
    parentTypeId: number,
    qr?: QueryRunner,
  ): Promise<void> {
    const rule = await this.typesRepository.findHierarchyRule(
      childTypeId,
      parentTypeId,
      qr,
    );
    if (!rule) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_HIERARCHY_RULE_VIOLATION,
          message: `Hierarchy rule violation: Unit type ID [${childTypeId}] is not permitted under parent type ID [${parentTypeId}].`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async validateC6_ParentExistsAndActive(
    parentId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const parent = await this.orgUnitsRepository.findById(parentId, qr);
    if (!parent) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_PARENT_INVALID,
          message: `Parent organization unit [${parentId}] was not found.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!parent.isActive) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_PARENT_INACTIVE,
          message: `Parent organization unit [${parent.orgCode}] is inactive or deleted.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return parent;
  }

  async validateC7_CodeUniqueAmongSiblings(
    parentId: number | null,
    code: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const existing = await this.orgUnitsRepository.findByCode(
      parentId,
      code,
      qr,
    );
    if (existing) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_CODE_DUPLICATE,
          message: `An active organization unit with Code [${code}] already exists under this parent level.`,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  validateC8_CodeFormat(code: string): void {
    if (!ORG_CODE_REGEX.test(code)) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_CODE_FORMAT,
          message:
            'Invalid Code format. Must start with an alphanumeric character and contain only uppercase letters, numbers, underscores, and hyphens (2-50 characters).',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async validateC10_CreatorScope(
    parentId: number,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      SELECT 1 AS isVisible
      FROM org.fn_VisibleOrgUnits(@0)
      WHERE OrgUnitId = @1;
    `;
    const rows = await this.getExecutor(qr).query(sql, [
      actorUserId,
      parentId,
    ]);
    if (rows.length === 0) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_SCOPE_DENIED,
          message:
            'Access denied: You do not have authorization scope over the target parent organization unit.',
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async validateCreate(
    dto: CreateOrgUnitDto,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<{ unitType: IOrgUnitType; parentUnit: IOrgUnit | null }> {
    this.validateC8_CodeFormat(dto.orgCode);

    const unitType = await this.validateC1_TypeExistsAndActive(
      dto.unitTypeId,
      qr,
    );

    let parentUnit: IOrgUnit | null = null;
    const isRootType = unitType.level === 1;

    if (isRootType) {
      this.validateC3_RootCannotHaveParent(true, dto.parentId);
      await this.validateC4_SingleActiveRoot(true, qr);
      await this.validateC7_CodeUniqueAmongSiblings(null, dto.orgCode, qr);
    } else {
      this.validateC2_ParentRequiredForNonRoot(false, dto.parentId);
      const parentId = dto.parentId!;

      parentUnit = await this.validateC6_ParentExistsAndActive(parentId, qr);

      await this.validateC5_HierarchyRule(
        unitType.unitTypeId,
        parentUnit.unitTypeId,
        qr,
      );

      await this.validateC7_CodeUniqueAmongSiblings(parentId, dto.orgCode, qr);

      await this.validateC10_CreatorScope(parentId, actorUserId, qr);
    }

    return { unitType, parentUnit };
  }

  async validateM1_NewParentExistsAndActive(
    newParentId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const parent = await this.orgUnitsRepository.findById(newParentId, qr);
    if (!parent || !parent.isActive) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_PARENT_INVALID,
          message: `Target new parent organization unit [${newParentId}] is invalid, inactive, or deleted.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return parent;
  }

  validateM2_NotMovingToSelf(nodeId: number, newParentId: number): void {
    if (nodeId === newParentId) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_MOVE_TO_SELF,
          message: 'Cannot reparent an organization unit beneath itself.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async validateM3_NotMovingToDescendant(
    nodeId: number,
    newParentId: number,
    qr?: QueryRunner,
  ): Promise<void> {
    const ancestors = await this.orgUnitsRepository.findAncestors(newParentId, qr);
    if (ancestors.some(a => a.orgUnitId === nodeId)) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_MOVE_CYCLE,
          message:
            'Hierarchy cycle detected: Cannot move an organization unit beneath one of its own descendants.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async validateM4_MoveHierarchyRule(
    nodeTypeId: number,
    newParentTypeId: number,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.validateC5_HierarchyRule(nodeTypeId, newParentTypeId, qr);
  }

  async validateM5_CodeUniqueAmongNewSiblings(
    nodeId: number,
    newParentId: number,
    code: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const existing = await this.orgUnitsRepository.findByCode(
      newParentId,
      code,
      qr,
    );
    if (existing && existing.orgUnitId !== nodeId) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_CODE_DUPLICATE,
          message: `An organization unit with Code [${code}] already exists under target parent [${newParentId}].`,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  async validateM6_ScopeOverOldAndNewParent(
    oldParentId: number | null,
    newParentId: number,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    if (oldParentId) {
      await this.validateC10_CreatorScope(oldParentId, actorUserId, qr);
    }
    await this.validateC10_CreatorScope(newParentId, actorUserId, qr);
  }

  async validateM7_SubtreeReferencesBlockMove(
    subtreeOrgUnitIds: number[],
  ): Promise<void> {
    const moveBlockers = this.referenceChecks.filter((r) => r.blocksMove);
    for (const checker of moveBlockers) {
      const count = await checker.countReferences(subtreeOrgUnitIds.map(id => String(id)));
      if (count > 0) {
        throw new HttpException(
          {
            code: ORG_ERROR_CODES.ORG_MOVE_BLOCKED_BUDGET,
            message: `Reorganization blocked: ${count} active reference(s) found in downstream module [${checker.name}].`,
          },
          HttpStatus.CONFLICT,
        );
      }
    }
  }

  async validateMove(
    orgUnitId: number,
    dto: MoveOrgUnitDto,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<{
    movingUnit: IOrgUnit;
    newParentUnit: IOrgUnit;
    subtreeIds: number[];
  }> {
    const movingUnit = await this.orgUnitsRepository.findById(orgUnitId, qr);
    if (!movingUnit) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    this.validateD5_RootProtected(movingUnit);

    this.validateM2_NotMovingToSelf(orgUnitId, dto.newParentId);

    const newParentUnit = await this.validateM1_NewParentExistsAndActive(
      dto.newParentId,
      qr,
    );

    await this.validateM3_NotMovingToDescendant(
      orgUnitId,
      dto.newParentId,
      qr,
    );

    await this.validateM4_MoveHierarchyRule(
      movingUnit.unitTypeId,
      newParentUnit.unitTypeId,
      qr,
    );

    await this.validateM5_CodeUniqueAmongNewSiblings(
      orgUnitId,
      dto.newParentId,
      movingUnit.orgCode,
      qr,
    );

    await this.validateM6_ScopeOverOldAndNewParent(
      movingUnit.parentId,
      dto.newParentId,
      actorUserId,
      qr,
    );

    const descendants = await this.orgUnitsRepository.findDescendants(orgUnitId, qr);
    const subtreeIds = [orgUnitId, ...descendants.map((d) => d.orgUnitId)];

    await this.validateM7_SubtreeReferencesBlockMove(subtreeIds);

    return { movingUnit, newParentUnit, subtreeIds };
  }

  async validateD1_NoActiveChildrenOnDeactivate(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<void> {
    const activeChildren = await this.orgUnitsRepository.countDirectChildren(
      orgUnitId,
      true,
      qr,
    );
    if (activeChildren > 0) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_HAS_ACTIVE_CHILDREN,
          message: `Cannot deactivate organization unit with ${activeChildren} active child unit(s). Deactivate children first.`,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  async validateD2_NoChildrenOnDelete(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<void> {
    const childCount = await this.orgUnitsRepository.countDirectChildren(
      orgUnitId,
      false,
      qr,
    );
    if (childCount > 0) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_HAS_CHILDREN,
          message: `Cannot delete organization unit with ${childCount} existing child unit(s). Delete or reparent children first.`,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  async validateD3_NoAssignedUsersOnDelete(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT user_id FROM auth.tbl_User_Roles
        WHERE org_unit_id = @0
        UNION ALL
        SELECT user_id FROM auth.tbl_Users
        WHERE org_unit_id = @0
      ) AS Assigned;
    `;
    const res = await this.getExecutor(qr).query(sql, [orgUnitId]);
    const total = Number(res[0]?.total || 0);

    if (total > 0) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_HAS_ASSIGNED_USERS,
          message: `Cannot delete organization unit: ${total} user assignment(s) are currently attached to this unit.`,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  async validateD4_NoRegisteredReferencesOnDelete(
    orgUnitId: number,
  ): Promise<void> {
    const deleteBlockers = this.referenceChecks.filter((r) => r.blocksDelete);
    for (const checker of deleteBlockers) {
      const count = await checker.countReferences([String(orgUnitId)]);
      if (count > 0) {
        throw new HttpException(
          {
            code: ORG_ERROR_CODES.ORG_REFERENCED,
            message: `Cannot delete organization unit: ${count} reference(s) exist in downstream module [${checker.name}].`,
          },
          HttpStatus.CONFLICT,
        );
      }
    }
  }

  validateD5_RootProtected(orgUnit: IOrgUnit): void {
    if (orgUnit.parentId === null) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_ROOT_PROTECTED,
          message:
            'The root holding organization unit is protected and cannot be deleted or reparented.',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  async validateDeactivate(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const unit = await this.orgUnitsRepository.findById(orgUnitId, qr);
    if (!unit) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    this.validateD5_RootProtected(unit);
    await this.validateD1_NoActiveChildrenOnDeactivate(orgUnitId, qr);

    return unit;
  }

  async validateDelete(orgUnitId: number, qr?: QueryRunner): Promise<IOrgUnit> {
    const unit = await this.orgUnitsRepository.findById(orgUnitId, qr);
    if (!unit) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    this.validateD5_RootProtected(unit);
    await this.validateD2_NoChildrenOnDelete(orgUnitId, qr);
    await this.validateD3_NoAssignedUsersOnDelete(orgUnitId, qr);
    await this.validateD4_NoRegisteredReferencesOnDelete(orgUnitId);

    return unit;
  }

  async validateG1_PrimaryHeadUniqueness(
    orgUnitId: number,
    effectiveFrom: string,
    effectiveTo?: string | null,
    excludeManagerId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      SELECT 1 AS existsPrimary
      FROM org.OrgUnitManagers
      WHERE OrgUnitId = @0
        AND manager_role_code = '${ORG_MANAGER_ROLES.HEAD}'
        AND is_primary = 1
        AND is_active = 1
        AND IsDeleted = 0
        AND (@1 IS NULL OR OrgUnitManagerId <> @1)
        AND (@2 IS NULL OR effective_from <= CAST(@2 AS DATE))
        AND (effective_to IS NULL OR effective_to >= CAST(@3 AS DATE));
    `;
    const rows = await this.getExecutor(qr).query(sql, [
      orgUnitId,
      excludeManagerId ?? null,
      effectiveTo ?? null,
      effectiveFrom,
    ]);
    if (rows.length > 0) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_PRIMARY_HEAD_EXISTS,
          message:
            'An active primary HEAD manager is already assigned to this unit during the specified date range.',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  async validateG3_NoManagerPeriodOverlap(
    orgUnitId: number,
    userId: string,
    roleCode: string,
    effectiveFrom: string,
    effectiveTo?: string | null,
    excludeManagerId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      SELECT 1 AS isOverlap
      FROM org.OrgUnitManagers
      WHERE OrgUnitId = @0
        AND UserId = @1
        AND manager_role_code = @2
        AND IsDeleted = 0
        AND (@3 IS NULL OR OrgUnitManagerId <> @3)
        AND (@4 IS NULL OR effective_from <= CAST(@4 AS DATE))
        AND (effective_to IS NULL OR effective_to >= CAST(@5 AS DATE));
    `;
    const rows = await this.getExecutor(qr).query(sql, [
      orgUnitId,
      userId,
      roleCode,
      excludeManagerId ?? null,
      effectiveTo ?? null,
      effectiveFrom,
    ]);
    if (rows.length > 0) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_MANAGER_PERIOD_OVERLAP,
          message: `Overlapping manager tenure detected for user [${userId}] with role [${roleCode}] on this unit.`,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  async validateG4_UserIsActiveAndInternal(
    userId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      SELECT user_id, UserType, is_active
      FROM auth.tbl_Users
      WHERE user_id = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [userId]);
    const user = rows[0];

    if (
      !user ||
      !user.is_active ||
      user.UserType !== 'INTERNAL'
    ) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_MANAGER_INVALID_USER,
          message:
            'The selected user is invalid, inactive, or not an INTERNAL employee. External vendor users cannot be managers.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async validateG5_UnitTypeAllowsManager(
    unitTypeId: number,
    qr?: QueryRunner,
  ): Promise<void> {
    const unitType = await this.typesRepository.findTypeById(unitTypeId, qr);
    if (!unitType) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_TYPE_INVALID,
          message: `Organization unit type [${unitTypeId}] does not permit manager assignments.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async validateAssignManager(
    orgUnitId: number,
    dto: AssignManagerDto,
    qr?: QueryRunner,
  ): Promise<{ unit: IOrgUnit }> {
    const unit = await this.orgUnitsRepository.findById(orgUnitId, qr);
    if (!unit) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.validateG5_UnitTypeAllowsManager(unit.unitTypeId, qr);

    await this.validateG4_UserIsActiveAndInternal(dto.userId, qr);

    await this.validateG3_NoManagerPeriodOverlap(
      orgUnitId,
      dto.userId,
      dto.managerRoleCode,
      dto.effectiveFrom,
      dto.effectiveTo ?? null,
      undefined,
      qr,
    );

    return { unit };
  }
}
