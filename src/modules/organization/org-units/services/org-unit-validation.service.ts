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
import { OrgUnitClosureRepository } from '../repositories/org-unit-closure.repository';
import { OrgUnitTypesRepository } from '../repositories/org-unit-types.repository';
import { OrgUnitsRepository } from '../repositories/org-units.repository';

@Injectable()
export class OrgUnitValidationService {
  constructor(
    private readonly orgUnitsRepository: OrgUnitsRepository,
    private readonly closureRepository: OrgUnitClosureRepository,
    private readonly typesRepository: OrgUnitTypesRepository,
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(ORG_UNIT_REFERENCE_CHECKS)
    private readonly referenceChecks: OrgUnitReferenceCheck[] = [],
  ) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  // ===========================================================================
  // SECTION 7.1: CREATION RULES (C1 – C10)
  // ===========================================================================

  /**
   * C1: OrgUnitTypeId must exist and be active.
   * Failure: 400 ORG_TYPE_INVALID
   */
  async validateC1_TypeExistsAndActive(
    orgUnitTypeId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnitType> {
    const unitType = await this.typesRepository.findTypeById(orgUnitTypeId, qr);
    if (!unitType || !unitType.isActive || unitType.isDeleted) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_TYPE_INVALID,
          message: `OrgUnitTypeId [${orgUnitTypeId}] is invalid, inactive, or does not exist.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return unitType;
  }

  /**
   * C2: Non-root types require a parent node.
   * Failure: 400 ORG_PARENT_REQUIRED
   */
  validateC2_ParentRequiredForNonRoot(
    isRootType: boolean,
    parentOrgUnitId?: string | null,
  ): void {
    if (!isRootType && (!parentOrgUnitId || parentOrgUnitId.trim() === '')) {
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

  /**
   * C3: Root types must have a NULL parent.
   * Failure: 400 ORG_ROOT_CANNOT_HAVE_PARENT
   */
  validateC3_RootCannotHaveParent(
    isRootType: boolean,
    parentOrgUnitId?: string | null,
  ): void {
    if (isRootType && parentOrgUnitId && parentOrgUnitId.trim() !== '') {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_ROOT_CANNOT_HAVE_PARENT,
          message: 'Root organization types cannot be assigned a parent unit.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * C4: Only one active root organization unit may exist in the system.
   * Failure: 409 ORG_ROOT_EXISTS
   */
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
            message: `An active root organization already exists with Code [${existingRoot.code}].`,
          },
          HttpStatus.CONFLICT,
        );
      }
    }
  }

  /**
   * C5: (childType, parentType) pair must exist in OrgUnitTypeHierarchyRules.
   * Failure: 400 ORG_HIERARCHY_RULE_VIOLATION
   */
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

  /**
   * C6: Parent unit must exist, be active, and not soft-deleted.
   * Failure: 400 ORG_PARENT_INACTIVE / ORG_PARENT_INVALID
   */
  async validateC6_ParentExistsAndActive(
    parentOrgUnitId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const parent = await this.orgUnitsRepository.findById(parentOrgUnitId, qr);
    if (!parent) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_PARENT_INVALID,
          message: `Parent organization unit [${parentOrgUnitId}] was not found.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!parent.isActive || parent.isDeleted) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_PARENT_INACTIVE,
          message: `Parent organization unit [${parent.code}] is inactive or deleted.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return parent;
  }

  /**
   * C7: Code must be unique among live siblings (case-insensitive).
   * Failure: 409 ORG_CODE_DUPLICATE
   */
  async validateC7_CodeUniqueAmongSiblings(
    parentOrgUnitId: string | null,
    code: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const existing = await this.orgUnitsRepository.findByCode(
      parentOrgUnitId,
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

  /**
   * C8: Code must match ^[A-Z0-9][A-Z0-9_-]{1,49}$
   * Failure: 400 ORG_CODE_FORMAT
   */
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

  /**
   * C9: EffectiveFrom must be greater than or equal to parent's EffectiveFrom.
   * Failure: 400 ORG_EFFECTIVE_BEFORE_PARENT
   */
  validateC9_EffectiveFromNotBeforeParent(
    effectiveFrom: string | Date,
    parentEffectiveFrom: string | Date,
  ): void {
    const childDate = new Date(effectiveFrom);
    const parentDate = new Date(parentEffectiveFrom);

    if (childDate < parentDate) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_EFFECTIVE_BEFORE_PARENT,
          message: `EffectiveFrom date [${childDate.toISOString().split('T')[0]}] cannot be earlier than parent unit EffectiveFrom date [${parentDate.toISOString().split('T')[0]}].`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * C10: Creator must have scope covering the parent node.
   * Failure: 403 ORG_SCOPE_DENIED
   */
  async validateC10_CreatorScope(
    parentOrgUnitId: string,
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
      parentOrgUnitId,
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

  /**
   * Orchestrator: Validates all C1–C10 creation rules in sequence.
   */
  async validateCreate(
    dto: CreateOrgUnitDto,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<{ unitType: IOrgUnitType; parentUnit: IOrgUnit | null }> {
    // C8: Code format
    this.validateC8_CodeFormat(dto.code);

    // C1: Unit type valid and active
    const unitType = await this.validateC1_TypeExistsAndActive(
      dto.orgUnitTypeId,
      qr,
    );

    let parentUnit: IOrgUnit | null = null;

    if (unitType.isRootType) {
      // C3: Root cannot have parent
      this.validateC3_RootCannotHaveParent(true, dto.parentOrgUnitId);
      // C4: Single active root check
      await this.validateC4_SingleActiveRoot(true, qr);
      // C7: Root code uniqueness
      await this.validateC7_CodeUniqueAmongSiblings(null, dto.code, qr);
    } else {
      // C2: Non-root requires parent
      this.validateC2_ParentRequiredForNonRoot(false, dto.parentOrgUnitId);
      const parentId = dto.parentOrgUnitId!;

      // C6: Parent exists and active
      parentUnit = await this.validateC6_ParentExistsAndActive(parentId, qr);

      // C5: Hierarchy rule
      await this.validateC5_HierarchyRule(
        unitType.orgUnitTypeId,
        parentUnit.orgUnitTypeId,
        qr,
      );

      // C7: Code uniqueness under parent
      await this.validateC7_CodeUniqueAmongSiblings(parentId, dto.code, qr);

      // C9: Effective date check
      if (dto.effectiveFrom) {
        this.validateC9_EffectiveFromNotBeforeParent(
          dto.effectiveFrom,
          parentUnit.effectiveFrom,
        );
      }

      // C10: Creator scope validation
      await this.validateC10_CreatorScope(parentId, actorUserId, qr);
    }

    return { unitType, parentUnit };
  }

  // ===========================================================================
  // SECTION 7.2: MOVE RULES (M1 – M8)
  // ===========================================================================

  /**
   * M1: New parent must exist, be active, and not soft-deleted.
   * Failure: 400 ORG_PARENT_INVALID
   */
  async validateM1_NewParentExistsAndActive(
    newParentId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const parent = await this.orgUnitsRepository.findById(newParentId, qr);
    if (!parent || !parent.isActive || parent.isDeleted) {
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

  /**
   * M2: New parent must not be the node itself.
   * Failure: 400 ORG_MOVE_TO_SELF
   */
  validateM2_NotMovingToSelf(nodeId: string, newParentId: string): void {
    if (nodeId.toLowerCase() === newParentId.toLowerCase()) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_MOVE_TO_SELF,
          message: 'Cannot reparent an organization unit beneath itself.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * M3: New parent must not be a descendant of the node (cycle detection).
   * Implemented via closure table isDescendantOf check.
   * Failure: 400 ORG_MOVE_CYCLE
   */
  async validateM3_NotMovingToDescendant(
    nodeId: string,
    newParentId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const isCycle = await this.closureRepository.isDescendantOf(
      newParentId,
      nodeId,
      qr,
    );
    if (isCycle) {
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

  /**
   * M4: (nodeType, newParentType) must satisfy OrgUnitTypeHierarchyRules.
   * Failure: 400 ORG_HIERARCHY_RULE_VIOLATION
   */
  async validateM4_MoveHierarchyRule(
    nodeTypeId: number,
    newParentTypeId: number,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.validateC5_HierarchyRule(nodeTypeId, newParentTypeId, qr);
  }

  /**
   * M5: Code must remain unique among new siblings.
   * Failure: 409 ORG_CODE_DUPLICATE
   */
  async validateM5_CodeUniqueAmongNewSiblings(
    nodeId: string,
    newParentId: string,
    code: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const existing = await this.orgUnitsRepository.findByCode(
      newParentId,
      code,
      qr,
    );
    if (existing && existing.orgUnitId.toLowerCase() !== nodeId.toLowerCase()) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_CODE_DUPLICATE,
          message: `An organization unit with Code [${code}] already exists under target parent [${newParentId}].`,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * M6: Actor must have scope over both old parent and new parent.
   * Failure: 403 ORG_SCOPE_DENIED
   */
  async validateM6_ScopeOverOldAndNewParent(
    oldParentId: string | null,
    newParentId: string,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    if (oldParentId) {
      await this.validateC10_CreatorScope(oldParentId, actorUserId, qr);
    }
    await this.validateC10_CreatorScope(newParentId, actorUserId, qr);
  }

  /**
   * M7: Blocked if the subtree has registered budget commitments in an open period.
   * Iterates through the registered OrgUnitReferenceCheck implementations.
   * Failure: 409 ORG_MOVE_BLOCKED_BUDGET
   */
  async validateM7_SubtreeReferencesBlockMove(
    subtreeOrgUnitIds: string[],
  ): Promise<void> {
    const moveBlockers = this.referenceChecks.filter((r) => r.blocksMove);
    for (const checker of moveBlockers) {
      const count = await checker.countReferences(subtreeOrgUnitIds);
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

  /**
   * M8: Optimistic concurrency check via RowVersion.
   * Failure: 409 ORG_CONCURRENCY_CONFLICT
   */
  validateM8_RowVersionConcurrency(
    currentRowVersion: string,
    expectedRowVersion: string,
  ): void {
    const cleanCurrent = currentRowVersion.toLowerCase().replace(/^0x/, '');
    const cleanExpected = expectedRowVersion.toLowerCase().replace(/^0x/, '');

    if (cleanCurrent !== cleanExpected) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_CONCURRENCY_CONFLICT,
          message:
            'The organization unit has been modified by another transaction. Please reload and retry.',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * Orchestrator: Validates all M1–M8 move rules in sequence.
   */
  async validateMove(
    orgUnitId: string,
    dto: MoveOrgUnitDto,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<{
    movingUnit: IOrgUnit;
    newParentUnit: IOrgUnit;
    subtreeIds: string[];
  }> {
    // 1. Fetch moving unit
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

    // Cannot move root organization
    this.validateD5_RootProtected(movingUnit);

    // M8: Concurrency check
    this.validateM8_RowVersionConcurrency(
      movingUnit.rowVersion,
      dto.rowVersion,
    );

    // M2: Not moving to self
    this.validateM2_NotMovingToSelf(orgUnitId, dto.newParentOrgUnitId);

    // M1: New parent exists and active
    const newParentUnit = await this.validateM1_NewParentExistsAndActive(
      dto.newParentOrgUnitId,
      qr,
    );

    // M3: Cycle detection (not moving under a descendant)
    await this.validateM3_NotMovingToDescendant(
      orgUnitId,
      dto.newParentOrgUnitId,
      qr,
    );

    // M4: Hierarchy rule
    await this.validateM4_MoveHierarchyRule(
      movingUnit.orgUnitTypeId,
      newParentUnit.orgUnitTypeId,
      qr,
    );

    // M5: Code uniqueness under new parent
    await this.validateM5_CodeUniqueAmongNewSiblings(
      orgUnitId,
      dto.newParentOrgUnitId,
      movingUnit.code,
      qr,
    );

    // M6: Scope authorization over old and new parent
    await this.validateM6_ScopeOverOldAndNewParent(
      movingUnit.parentOrgUnitId,
      dto.newParentOrgUnitId,
      actorUserId,
      qr,
    );

    // Fetch all subtree IDs for reference check
    const subtreeIds = await this.closureRepository.getDescendantIds(
      orgUnitId,
      qr,
    );

    // M7: Downstream reference checks
    await this.validateM7_SubtreeReferencesBlockMove(subtreeIds);

    return { movingUnit, newParentUnit, subtreeIds };
  }

  // ===========================================================================
  // SECTION 7.3: DEACTIVATE / DELETE RULES (D1 – D7)
  // ===========================================================================

  /**
   * D1: Cannot deactivate unit with active children.
   * Failure: 409 ORG_HAS_ACTIVE_CHILDREN
   */
  async validateD1_NoActiveChildrenOnDeactivate(
    orgUnitId: string,
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

  /**
   * D2: Cannot delete unit with any non-deleted children.
   * Failure: 409 ORG_HAS_CHILDREN
   */
  async validateD2_NoChildrenOnDelete(
    orgUnitId: string,
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

  /**
   * D3: Cannot delete unit if users are currently assigned.
   * Failure: 409 ORG_HAS_ASSIGNED_USERS
   */
  async validateD3_NoAssignedUsersOnDelete(
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT UserOrgUnitAssignmentId FROM org.UserOrgUnitAssignments
        WHERE OrgUnitId = @0 AND IsDeleted = 0 AND IsActive = 1
        UNION ALL
        SELECT UserProfileID FROM auth.UserProfiles
        WHERE (DepartmentID = @0 OR BusinessUnitID = @0 OR SectionID = @0)
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

  /**
   * D4: Cannot delete if referenced by any registered downstream consumer.
   * Failure: 409 ORG_REFERENCED
   */
  async validateD4_NoRegisteredReferencesOnDelete(
    orgUnitId: string,
  ): Promise<void> {
    const deleteBlockers = this.referenceChecks.filter((r) => r.blocksDelete);
    for (const checker of deleteBlockers) {
      const count = await checker.countReferences([orgUnitId]);
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

  /**
   * D5: Root organization can never be deleted or deactivated.
   * Failure: 409 ORG_ROOT_PROTECTED
   */
  validateD5_RootProtected(orgUnit: IOrgUnit): void {
    if (orgUnit.parentOrgUnitId === null || orgUnit.orgUnitTypeId === 1) {
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

  /**
   * Orchestrator: Validates deactivation rules (D1, D5).
   */
  async validateDeactivate(
    orgUnitId: string,
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

  /**
   * Orchestrator: Validates deletion rules (D2, D3, D4, D5).
   */
  async validateDelete(orgUnitId: string, qr?: QueryRunner): Promise<IOrgUnit> {
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

  // ===========================================================================
  // SECTION 7.4: MANAGER RULES (G1 – G7)
  // ===========================================================================

  /**
   * G1: At most one active HEAD with IsPrimary=1 per unit per date.
   * Failure: 409 ORG_PRIMARY_HEAD_EXISTS
   */
  async validateG1_PrimaryHeadUniqueness(
    orgUnitId: string,
    effectiveFrom: string,
    effectiveTo?: string | null,
    excludeManagerId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      SELECT 1 AS existsPrimary
      FROM org.OrgUnitManagers
      WHERE OrgUnitId = @0
        AND ManagerRoleCode = '${ORG_MANAGER_ROLES.HEAD}'
        AND IsPrimary = 1
        AND IsActive = 1
        AND IsDeleted = 0
        AND (@1 IS NULL OR OrgUnitManagerId <> @1)
        AND (@2 IS NULL OR EffectiveFrom <= CAST(@2 AS DATE))
        AND (EffectiveTo IS NULL OR EffectiveTo >= CAST(@3 AS DATE));
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

  /**
   * G3: Overlapping periods for the same user + unit + role are rejected.
   * Failure: 409 ORG_MANAGER_PERIOD_OVERLAP
   */
  async validateG3_NoManagerPeriodOverlap(
    orgUnitId: string,
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
        AND ManagerRoleCode = @2
        AND IsDeleted = 0
        AND (@3 IS NULL OR OrgUnitManagerId <> @3)
        AND (@4 IS NULL OR EffectiveFrom <= CAST(@4 AS DATE))
        AND (EffectiveTo IS NULL OR EffectiveTo >= CAST(@5 AS DATE));
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

  /**
   * G4: User must be active and INTERNAL. Vendors can never be managers.
   * Failure: 400 ORG_MANAGER_INVALID_USER
   */
  async validateG4_UserIsActiveAndInternal(
    userId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      SELECT UserID, UserType, IsActive, IsDeleted
      FROM auth.Users
      WHERE UserID = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [userId]);
    const user = rows[0];

    if (
      !user ||
      !user.IsActive ||
      user.IsDeleted ||
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

  /**
   * G5: Unit type must have AllowsManager = 1.
   * Failure: 400 ORG_TYPE_NO_MANAGER
   */
  async validateG5_UnitTypeAllowsManager(
    unitTypeId: number,
    qr?: QueryRunner,
  ): Promise<void> {
    const unitType = await this.typesRepository.findTypeById(unitTypeId, qr);
    if (!unitType || !unitType.allowsManager) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_TYPE_NO_MANAGER,
          message: `Organization unit type [${unitType?.code || unitTypeId}] does not permit manager assignments.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Orchestrator: Validates manager assignment rules (G3, G4, G5).
   */
  async validateAssignManager(
    orgUnitId: string,
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

    // G5: AllowsManager check
    await this.validateG5_UnitTypeAllowsManager(unit.orgUnitTypeId, qr);

    // G4: User is active INTERNAL
    await this.validateG4_UserIsActiveAndInternal(dto.userId, qr);

    // G3: Overlap check
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
