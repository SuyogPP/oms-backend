import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { UsersRepository } from '../repositories/users.repository';
import {
  USER_ERROR_CODES,
  USER_TYPES,
  UserType,
  SCOPE_CODES,
} from '../users.constants';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AssignScopeDto } from '../../user-assignments/dto/assign-scope.dto';

@Injectable()
export class UserValidationService {
  private readonly logger = new Logger(UserValidationService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly dataSource: DataSource,
  ) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  // ===========================================================================
  // SECTION 1: SECTION 5.1 CREATION RULES (U1 – U10)
  // ===========================================================================

  /**
   * U1: Email unique across all users including soft-deleted (UX_Users_Email).
   * Failure: 409 USER_EMAIL_EXISTS
   */
  async validateU1_EmailUnique(
    email: string,
    excludeUserId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    if (!email) {
      return;
    }

    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP 1 UserID AS userId
      FROM [auth].[Users]
      WHERE LOWER(Email) = LOWER(@0)
        AND (@1 IS NULL OR UserID != @1);
      `,
      [email.trim(), excludeUserId || null],
    );

    if (rows && rows.length > 0) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_EMAIL_EXISTS,
          error: USER_ERROR_CODES.USER_EMAIL_EXISTS,
          message: `Email address [${email}] is already registered in the system.`,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * U2: Username unique across all users (UX_Users_Username).
   * Failure: 409 USER_USERNAME_EXISTS
   */
  async validateU2_UsernameUnique(
    username: string,
    excludeUserId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    if (!username) {
      return;
    }

    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP 1 UserID AS userId
      FROM [auth].[Users]
      WHERE LOWER(Username) = LOWER(@0)
        AND (@1 IS NULL OR UserID != @1);
      `,
      [username.trim(), excludeUserId || null],
    );

    if (rows && rows.length > 0) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_USERNAME_EXISTS,
          error: USER_ERROR_CODES.USER_USERNAME_EXISTS,
          message: `Username [${username}] is already taken.`,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * U3: UserType must match a seeded auth.UserTypes.UserTypeCode.
   * Failure: 400 USER_TYPE_INVALID
   */
  async validateU3_UserType(userType: string, qr?: QueryRunner): Promise<void> {
    const validCodes = Object.values(USER_TYPES);
    if (!validCodes.includes(userType as UserType)) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_TYPE_INVALID,
          error: USER_ERROR_CODES.USER_TYPE_INVALID,
          message: `UserType [${userType}] is invalid. Allowed types: ${validCodes.join(', ')}.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP 1 UserTypeID
      FROM [auth].[UserTypes]
      WHERE UserTypeCode = @0;
      `,
      [userType],
    );

    if (!rows || rows.length === 0) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_TYPE_INVALID,
          error: USER_ERROR_CODES.USER_TYPE_INVALID,
          message: `UserType [${userType}] is not recognized in the system database.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * U4: INTERNAL users require EmployeeID.
   * Failure: 400 USER_EMPLOYEE_ID_REQUIRED
   */
  validateU4_InternalUserEmployeeId(
    userType: string,
    employeeId?: string | null,
  ): void {
    if (userType === USER_TYPES.INTERNAL) {
      if (!employeeId || employeeId.trim() === '') {
        throw new HttpException(
          {
            code: USER_ERROR_CODES.USER_EMPLOYEE_ID_REQUIRED,
            error: USER_ERROR_CODES.USER_EMPLOYEE_ID_REQUIRED,
            message: 'Internal users require an Employee ID.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  /**
   * U5: VENDOR users must not have EmployeeID, and must link to a vendor.
   * Failure: 400 USER_VENDOR_INVALID
   */
  validateU5_VendorUserConstraints(
    userType: string,
    employeeId?: string | null,
    vendorId?: string | null,
  ): void {
    if (userType === USER_TYPES.VENDOR) {
      if (employeeId && employeeId.trim() !== '') {
        throw new HttpException(
          {
            code: USER_ERROR_CODES.USER_VENDOR_INVALID,
            error: USER_ERROR_CODES.USER_VENDOR_INVALID,
            message: 'Vendor users must not have an internal Employee ID.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!vendorId || vendorId.trim() === '') {
        throw new HttpException(
          {
            code: USER_ERROR_CODES.USER_VENDOR_INVALID,
            error: USER_ERROR_CODES.USER_VENDOR_INVALID,
            message:
              'Vendor users must be linked to a valid Vendor record (VendorID).',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  /**
   * U7: Org unit IDs on profile must exist, be active, not deleted, and match expected OrgUnitTypeId.
   * Failure: 400 USER_ORG_UNIT_INVALID
   */
  async validateU7_OrgUnitReferences(
    profile?: {
      organizationId?: string | null;
      businessUnitId?: string | null;
      departmentId?: string | null;
      sectionId?: string | null;
    },
    qr?: QueryRunner,
  ): Promise<void> {
    if (!profile) return;

    const unitsToCheck = [
      { id: profile.organizationId, expectedType: 1, name: 'Organization' },
      { id: profile.businessUnitId, expectedType: 2, name: 'Business Unit' },
      { id: profile.departmentId, expectedType: 3, name: 'Department' },
      { id: profile.sectionId, expectedType: 4, name: 'Section' },
    ];

    for (const unit of unitsToCheck) {
      if (unit.id) {
        const rows = await this.getExecutor(qr).query(
          `
          SELECT OrgUnitId, OrgUnitTypeId, IsActive, IsDeleted
          FROM [org].[OrgUnits]
          WHERE OrgUnitId = @0;
          `,
          [unit.id],
        );

        if (
          !rows ||
          rows.length === 0 ||
          rows[0].IsDeleted === 1 ||
          rows[0].IsActive !== 1
        ) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.USER_ORG_UNIT_INVALID,
              error: USER_ERROR_CODES.USER_ORG_UNIT_INVALID,
              message: `${unit.name} org unit [${unit.id}] does not exist, is inactive, or has been deleted.`,
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        if (rows[0].OrgUnitTypeId !== unit.expectedType) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.USER_ORG_UNIT_INVALID,
              error: USER_ERROR_CODES.USER_ORG_UNIT_INVALID,
              message: `${unit.name} ID [${unit.id}] points to an org unit of mismatched type (type ${rows[0].OrgUnitTypeId} instead of ${unit.expectedType}).`,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    }
  }

  /**
   * U8: Creator's scope must cover the assigned department.
   * Failure: 403 USER_SCOPE_DENIED
   */
  async validateU8_CreatorScopeCoversDepartment(
    creatorUserId?: string,
    targetDepartmentId?: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    if (!creatorUserId || !targetDepartmentId) {
      return;
    }

    // Check if creator holds GLOBAL scope
    const globalScopeRows = await this.getExecutor(qr).query(
      `
      SELECT 1 FROM [auth].[UserOrganizationScopes] s
      INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
      WHERE s.UserID = @0
        AND sd.ScopeCode = 'GLOBAL'
        AND (s.IsActive = 1 OR s.IsActive IS NULL)
        AND (s.EffectiveFrom IS NULL OR s.EffectiveFrom <= SYSUTCDATETIME())
        AND (s.EffectiveTo IS NULL OR s.EffectiveTo > SYSUTCDATETIME());
      `,
      [creatorUserId],
    );

    if (globalScopeRows && globalScopeRows.length > 0) {
      return; // Global scope bypasses org tree restrictions
    }

    // Verify department is within creator's visible subtree
    const visibleRows = await this.getExecutor(qr).query(
      `
      SELECT 1
      FROM [org].[fn_VisibleOrgUnits](@0)
      WHERE OrgUnitId = @1;
      `,
      [creatorUserId, targetDepartmentId],
    );

    if (!visibleRows || visibleRows.length === 0) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_SCOPE_DENIED,
          error: USER_ERROR_CODES.USER_SCOPE_DENIED,
          message: `Creator cannot assign users to department [${targetDepartmentId}] outside their visible scope.`,
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  // ===========================================================================
  // SECTION 2: SECTION 5.5 & 9.1 SELF-ACTION & HIGH-CONSEQUENCE GUARDS (U14–U16)
  // ===========================================================================

  /**
   * U14 & §9.1: Cannot perform self-actions (deactivate, delete, alter roles, scope, overrides).
   * Failure: 409 USER_SELF_ACTION
   */
  validateU14_SelfAction(
    targetUserId: string,
    operatorUserId?: string,
    actionDescription: string = 'modify your own account',
  ): void {
    if (operatorUserId && targetUserId === operatorUserId) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_SELF_ACTION,
          error: USER_ERROR_CODES.USER_SELF_ACTION,
          message: `Cannot ${actionDescription}. Self-modification is strictly forbidden for security and segregation of duties.`,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * U15: Cannot deactivate or delete the last active SYSTEM_ADMIN.
   * Failure: 409 USER_LAST_ADMIN
   */
  async validateU15_LastSystemAdmin(
    targetUserId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    // Check if target user holds active SYSTEM_ADMIN role
    const userAdminRows = await this.getExecutor(qr).query(
      `
      SELECT 1
      FROM [auth].[UserRoles] ur
      INNER JOIN [auth].[Roles] r ON r.RoleID = ur.RoleID
      WHERE ur.UserID = @0
        AND r.RoleCode = 'SYSTEM_ADMIN'
        AND ur.IsActive = 1
        AND ur.EffectiveFrom <= SYSUTCDATETIME()
        AND (ur.EffectiveTo IS NULL OR ur.EffectiveTo > SYSUTCDATETIME());
      `,
      [targetUserId],
    );

    if (!userAdminRows || userAdminRows.length === 0) {
      return; // Target user is not a system admin
    }

    const adminCount = await this.usersRepository.countActiveSystemAdmins(qr);
    if (adminCount <= 1) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_LAST_ADMIN,
          error: USER_ERROR_CODES.USER_LAST_ADMIN,
          message:
            'Cannot deactivate or delete the last active SYSTEM_ADMIN in the system.',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * U16: Cannot delete a user who is the current primary head of any org unit.
   * Query org.OrgManagers, not org.OrgUnits.HeadUserId per spec & schema.
   * Failure: 409 USER_IS_ORG_HEAD
   */
  async validateU16_PrimaryOrgUnitHead(
    targetUserId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const isHead = await this.usersRepository.isUserPrimaryHeadOfAnyOrgUnit(
      targetUserId,
      qr,
    );

    if (isHead) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_IS_ORG_HEAD,
          error: USER_ERROR_CODES.USER_IS_ORG_HEAD,
          message:
            'Cannot delete a user who is currently assigned as the primary Head of an active organizational unit.',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  // ===========================================================================
  // SECTION 3: SECTION 6.1 & 6.2 SCOPE ASSIGNMENT RULES (S1 – S8)
  // ===========================================================================

  /**
   * S1 & §6.1: Exactly one scope column populated matching the scope code, all others NULL.
   * Failure: 400 SCOPE_ASSIGNMENT_INVALID
   * Returns the referenced OrgUnitId (or null for GLOBAL/SELF).
   */
  validateS1_ScopeColumns(
    scopeCode: string,
    cols: {
      organizationId?: string | null;
      businessUnitId?: string | null;
      departmentId?: string | null;
      sectionId?: string | null;
      orgUnitId?: string | null;
    },
  ): string | null {
    const {
      organizationId,
      businessUnitId,
      departmentId,
      sectionId,
      orgUnitId,
    } = cols;

    switch (scopeCode) {
      case SCOPE_CODES.GLOBAL:
      case SCOPE_CODES.SELF:
        if (
          organizationId ||
          businessUnitId ||
          departmentId ||
          sectionId ||
          orgUnitId
        ) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              error: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              message: `Scope [${scopeCode}] must not have any organizational unit columns populated.`,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        return null;

      case SCOPE_CODES.ORGANIZATION: {
        if (businessUnitId || departmentId || sectionId) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              error: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              message:
                'ORGANIZATION scope must only populate OrganizationID/OrgUnitId, all other unit columns must be NULL.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        const orgId = organizationId || orgUnitId;
        if (!orgId) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              error: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              message: 'ORGANIZATION scope requires OrganizationID.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        return orgId;
      }

      case SCOPE_CODES.BUSINESS_UNIT: {
        if (organizationId || departmentId || sectionId) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              error: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              message:
                'BUSINESS_UNIT scope must only populate BusinessUnitID/OrgUnitId, all other unit columns must be NULL.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        const buId = businessUnitId || orgUnitId;
        if (!buId) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              error: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              message: 'BUSINESS_UNIT scope requires BusinessUnitID.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        return buId;
      }

      case SCOPE_CODES.DEPARTMENT: {
        if (organizationId || businessUnitId || sectionId) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              error: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              message:
                'DEPARTMENT scope must only populate DepartmentID/OrgUnitId, all other unit columns must be NULL.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        const deptId = departmentId || orgUnitId;
        if (!deptId) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              error: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              message: 'DEPARTMENT scope requires DepartmentID.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        return deptId;
      }

      case SCOPE_CODES.SECTION: {
        if (organizationId || businessUnitId || departmentId) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              error: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              message:
                'SECTION scope must only populate SectionID/OrgUnitId, all other unit columns must be NULL.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        const secId = sectionId || orgUnitId;
        if (!secId) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              error: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              message: 'SECTION scope requires SectionID.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        return secId;
      }

      default:
        throw new HttpException(
          {
            code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
            error: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
            message: `Unknown scope code [${scopeCode}].`,
          },
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  /**
   * S2: Referenced org unit must exist, be active, not deleted, and match the scope definition type.
   * Failure: 400 SCOPE_ORG_UNIT_INVALID
   */
  async validateS2_ScopeOrgUnitType(
    scopeCode: string,
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    if (!orgUnitId) return;

    const expectedTypeMap: Record<string, number> = {
      [SCOPE_CODES.ORGANIZATION]: 1,
      [SCOPE_CODES.BUSINESS_UNIT]: 2,
      [SCOPE_CODES.DEPARTMENT]: 3,
      [SCOPE_CODES.SECTION]: 4,
    };

    const expectedType = expectedTypeMap[scopeCode];
    if (!expectedType) return;

    const rows = await this.getExecutor(qr).query(
      `
      SELECT OrgUnitId, OrgUnitTypeId, IsActive, IsDeleted
      FROM [org].[OrgUnits]
      WHERE OrgUnitId = @0;
      `,
      [orgUnitId],
    );

    if (
      !rows ||
      rows.length === 0 ||
      rows[0].IsDeleted === 1 ||
      rows[0].IsActive !== 1
    ) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.SCOPE_ORG_UNIT_INVALID,
          error: USER_ERROR_CODES.SCOPE_ORG_UNIT_INVALID,
          message: `Referenced org unit [${orgUnitId}] does not exist, is inactive, or has been deleted.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (rows[0].OrgUnitTypeId !== expectedType) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.SCOPE_ORG_UNIT_INVALID,
          error: USER_ERROR_CODES.SCOPE_ORG_UNIT_INVALID,
          message: `Scope [${scopeCode}] requires an org unit of type ${expectedType}, but [${orgUnitId}] is of type ${rows[0].OrgUnitTypeId}.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * S3: Granting GLOBAL scope requires granter to hold SYSTEM_ADMIN role.
   * Failure: 403 SCOPE_ESCALATION
   */
  async validateS3_GlobalScopeGrant(
    scopeCode: string,
    granterUserId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    if (scopeCode === SCOPE_CODES.GLOBAL && granterUserId) {
      const rows = await this.getExecutor(qr).query(
        `
        SELECT 1
        FROM [auth].[UserRoles] ur
        INNER JOIN [auth].[Roles] r ON r.RoleID = ur.RoleID
        WHERE ur.UserID = @0
          AND r.RoleCode = 'SYSTEM_ADMIN'
          AND ur.IsActive = 1
          AND ur.EffectiveFrom <= SYSUTCDATETIME()
          AND (ur.EffectiveTo IS NULL OR ur.EffectiveTo > SYSUTCDATETIME());
        `,
        [granterUserId],
      );

      if (!rows || rows.length === 0) {
        throw new HttpException(
          {
            code: USER_ERROR_CODES.SCOPE_ESCALATION,
            error: USER_ERROR_CODES.SCOPE_ESCALATION,
            message: 'Granting GLOBAL scope requires the SYSTEM_ADMIN role.',
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }
  }

  /**
   * S4: Cannot grant scope broader than your own or outside your visible subtree.
   * Failure: 403 SCOPE_ESCALATION
   */
  async validateS4_ScopeEscalation(
    scopeCode: string,
    targetOrgUnitId: string | null,
    granterUserId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    if (!granterUserId) {
      return;
    }

    // Check if granter has GLOBAL scope
    const isGlobalRows = await this.getExecutor(qr).query(
      `
      SELECT 1 FROM [auth].[UserOrganizationScopes] s
      INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
      WHERE s.UserID = @0
        AND sd.ScopeCode = 'GLOBAL'
        AND (s.IsActive = 1 OR s.IsActive IS NULL)
        AND (s.EffectiveFrom IS NULL OR s.EffectiveFrom <= SYSUTCDATETIME())
        AND (s.EffectiveTo IS NULL OR s.EffectiveTo > SYSUTCDATETIME());
      `,
      [granterUserId],
    );

    if (isGlobalRows && isGlobalRows.length > 0) {
      return; // Global granter can grant any scope
    }

    // Granter cannot grant GLOBAL scope if they don't have it
    if (scopeCode === SCOPE_CODES.GLOBAL) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.SCOPE_ESCALATION,
          error: USER_ERROR_CODES.SCOPE_ESCALATION,
          message: 'Cannot grant GLOBAL scope without possessing GLOBAL scope.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Scope hierarchy depth (Lower number = Broader scope)
    const scopeDepthMap: Record<string, number> = {
      [SCOPE_CODES.GLOBAL]: 0,
      [SCOPE_CODES.ORGANIZATION]: 1,
      [SCOPE_CODES.BUSINESS_UNIT]: 2,
      [SCOPE_CODES.DEPARTMENT]: 3,
      [SCOPE_CODES.SECTION]: 4,
      [SCOPE_CODES.SELF]: 5,
    };

    const targetDepth = scopeDepthMap[scopeCode] ?? 99;

    // Determine granter's broadest active scope
    const granterScopes = await this.getExecutor(qr).query(
      `
      SELECT sd.ScopeCode AS scopeCode
      FROM [auth].[UserOrganizationScopes] s
      INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
      WHERE s.UserID = @0
        AND (s.IsActive = 1 OR s.IsActive IS NULL)
        AND (s.EffectiveFrom IS NULL OR s.EffectiveFrom <= SYSUTCDATETIME())
        AND (s.EffectiveTo IS NULL OR s.EffectiveTo > SYSUTCDATETIME());
      `,
      [granterUserId],
    );

    if (!granterScopes || granterScopes.length === 0) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.SCOPE_ESCALATION,
          error: USER_ERROR_CODES.SCOPE_ESCALATION,
          message:
            'Granter has no active scopes and cannot assign scopes to others.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const granterMinDepth = Math.min(
      ...granterScopes.map((s: any) => scopeDepthMap[s.scopeCode] ?? 99),
    );

    if (targetDepth < granterMinDepth) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.SCOPE_ESCALATION,
          error: USER_ERROR_CODES.SCOPE_ESCALATION,
          message: `Cannot grant scope [${scopeCode}] which is broader than granter's highest scope depth.`,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // If unit-targeted, verify org unit is within granter's visible subtree
    if (targetOrgUnitId) {
      const visibleRows = await this.getExecutor(qr).query(
        `
        SELECT 1 FROM [org].[fn_VisibleOrgUnits](@0) WHERE OrgUnitId = @1;
        `,
        [granterUserId, targetOrgUnitId],
      );

      if (!visibleRows || visibleRows.length === 0) {
        throw new HttpException(
          {
            code: USER_ERROR_CODES.SCOPE_ESCALATION,
            error: USER_ERROR_CODES.SCOPE_ESCALATION,
            message: `Cannot grant scope on org unit [${targetOrgUnitId}] outside granter's visible hierarchy.`,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }
  }

  /**
   * S5: VENDOR users get no organizational scope.
   * Failure: 400 SCOPE_VENDOR_NOT_ALLOWED
   */
  validateS5_VendorScopeRestriction(userType: string): void {
    if (userType === USER_TYPES.VENDOR) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.SCOPE_VENDOR_NOT_ALLOWED,
          error: USER_ERROR_CODES.SCOPE_VENDOR_NOT_ALLOWED,
          message:
            'Vendor users cannot receive organizational scope assignments.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * S6: Duplicate active scope for the same unit is rejected.
   * Failure: 409 SCOPE_DUPLICATE
   */
  async validateS6_DuplicateScope(
    userId: string,
    scopeDefinitionId: string,
    orgUnitId: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP 1 UserOrganizationScopeID
      FROM [auth].[UserOrganizationScopes]
      WHERE UserID = @0
        AND ScopeDefinitionID = @1
        AND (
            (@2 IS NULL AND OrgUnitId IS NULL AND DepartmentID IS NULL AND BusinessUnitID IS NULL AND SectionID IS NULL AND OrganizationID IS NULL)
            OR OrgUnitId = @2
            OR DepartmentID = @2
            OR BusinessUnitID = @2
            OR SectionID = @2
            OR OrganizationID = @2
        )
        AND (IsActive = 1 OR IsActive IS NULL)
        AND (EffectiveTo IS NULL OR EffectiveTo > SYSUTCDATETIME());
      `,
      [userId, scopeDefinitionId, orgUnitId || null],
    );

    if (rows && rows.length > 0) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.SCOPE_DUPLICATE,
          error: USER_ERROR_CODES.SCOPE_DUPLICATE,
          message:
            'An active scope assignment for this scope definition and unit already exists for the user.',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * S8: Cannot remove your own last scope.
   * Failure: 409 USER_SELF_ACTION
   */
  validateS8_SelfScopeRemoval(
    targetUserId: string,
    operatorUserId?: string,
    activeScopeCount: number = 0,
  ): void {
    if (operatorUserId && targetUserId === operatorUserId) {
      if (activeScopeCount <= 1) {
        throw new HttpException(
          {
            code: USER_ERROR_CODES.USER_SELF_ACTION,
            error: USER_ERROR_CODES.USER_SELF_ACTION,
            message:
              'Cannot remove your own last remaining organizational scope.',
          },
          HttpStatus.CONFLICT,
        );
      }
    }
  }

  // ===========================================================================
  // SECTION 4: SECTION 7 VENDOR USER RULES (V1 – V10)
  // ===========================================================================

  /**
   * V1: UserType must be VENDOR.
   * Failure: 400 USER_TYPE_INVALID
   */
  validateV1_VendorUserType(userType: string): void {
    if (userType !== USER_TYPES.VENDOR) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_TYPE_INVALID,
          error: USER_ERROR_CODES.USER_TYPE_INVALID,
          message: 'Vendor user management is restricted to VENDOR user type.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * V2: Must link to a vendor record.
   * Failure: 400 VENDOR_REQUIRED
   */
  validateV2_VendorLink(vendorId?: string | null): void {
    if (!vendorId || vendorId.trim() === '') {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.VENDOR_REQUIRED,
          error: USER_ERROR_CODES.VENDOR_REQUIRED,
          message:
            'Vendor user must be linked to a valid Vendor record (vendorId).',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * V3: Never assigned internal roles. Only vendor-scoped roles.
   * Failure: 400 VENDOR_ROLE_INVALID
   */
  async validateV3_VendorRoles(
    userType: string,
    roleId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    if (userType === USER_TYPES.VENDOR) {
      const rows = await this.getExecutor(qr).query(
        `
        SELECT RoleCode, RoleName
        FROM [auth].[Roles]
        WHERE RoleID = @0;
        `,
        [roleId],
      );

      if (rows && rows.length > 0) {
        const roleCode = rows[0].RoleCode.toUpperCase();
        // Vendor roles must have VENDOR prefix or designated vendor flag
        if (!roleCode.startsWith('VENDOR')) {
          throw new HttpException(
            {
              code: USER_ERROR_CODES.VENDOR_ROLE_INVALID,
              error: USER_ERROR_CODES.VENDOR_ROLE_INVALID,
              message: `Vendor users cannot be assigned internal role [${rows[0].RoleCode}]. Only vendor-scoped roles are permitted.`,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    }
  }

  /**
   * V4: Never assigned organizational scope (S5).
   * Failure: 400 VENDOR_SCOPE_NOT_ALLOWED
   */
  validateV4_VendorScope(userType: string): void {
    if (userType === USER_TYPES.VENDOR) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.VENDOR_SCOPE_NOT_ALLOWED,
          error: USER_ERROR_CODES.VENDOR_SCOPE_NOT_ALLOWED,
          message: 'Vendor users cannot be assigned organizational scope.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * V5: Never assigned to an org unit on their profile.
   * Failure: 400 VENDOR_ORG_UNIT_NOT_ALLOWED
   */
  validateV5_VendorOrgUnitProfile(
    userType: string,
    profile?: {
      organizationId?: string | null;
      businessUnitId?: string | null;
      departmentId?: string | null;
      sectionId?: string | null;
    },
  ): void {
    if (userType === USER_TYPES.VENDOR && profile) {
      if (
        profile.organizationId ||
        profile.businessUnitId ||
        profile.departmentId ||
        profile.sectionId
      ) {
        throw new HttpException(
          {
            code: USER_ERROR_CODES.VENDOR_ORG_UNIT_NOT_ALLOWED,
            error: USER_ERROR_CODES.VENDOR_ORG_UNIT_NOT_ALLOWED,
            message:
              'Vendor users must not be assigned to internal organizational units on their profile.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  // ===========================================================================
  // SECTION 5: COMPOSITE VALIDATION WORKFLOWS
  // ===========================================================================

  /**
   * Full validation suite for User Creation (§5.1 & §7).
   */
  async validateCreateUser(
    dto: CreateUserDto,
    creatorUserId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.validateU1_EmailUnique(dto.email, undefined, qr);
    await this.validateU2_UsernameUnique(dto.username, undefined, qr);
    await this.validateU3_UserType(dto.userType, qr);
    this.validateU4_InternalUserEmployeeId(dto.userType, dto.employeeId);
    this.validateU5_VendorUserConstraints(
      dto.userType,
      dto.employeeId,
      dto.profile?.vendorId,
    );
    this.validateV5_VendorOrgUnitProfile(dto.userType, dto.profile);
    await this.validateU7_OrgUnitReferences(dto.profile, qr);
    await this.validateU8_CreatorScopeCoversDepartment(
      creatorUserId,
      dto.profile?.departmentId,
      qr,
    );
  }

  /**
   * Full validation suite for User Updates.
   */
  async validateUpdateUser(
    userId: string,
    dto: UpdateUserDto,
    updaterUserId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    if (dto.email) {
      await this.validateU1_EmailUnique(dto.email, userId, qr);
    }
    if (dto.username) {
      await this.validateU2_UsernameUnique(dto.username, userId, qr);
    }
    if (dto.userType) {
      await this.validateU3_UserType(dto.userType, qr);
      this.validateU4_InternalUserEmployeeId(dto.userType, dto.employeeId);
      this.validateU5_VendorUserConstraints(
        dto.userType,
        dto.employeeId,
        dto.profile?.vendorId,
      );
      this.validateV5_VendorOrgUnitProfile(dto.userType, dto.profile);
    }
    if (dto.profile) {
      await this.validateU7_OrgUnitReferences(dto.profile, qr);
    }
  }

  /**
   * Validation for User Deactivation (§5.5 & §9.1).
   */
  async validateDeactivateUser(
    targetUserId: string,
    operatorUserId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    this.validateU14_SelfAction(
      targetUserId,
      operatorUserId,
      'deactivate your own account',
    );
    await this.validateU15_LastSystemAdmin(targetUserId, qr);
  }

  /**
   * Validation for User Soft Deletion (§5.5 & §9.1).
   */
  async validateDeleteUser(
    targetUserId: string,
    operatorUserId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    this.validateU14_SelfAction(
      targetUserId,
      operatorUserId,
      'delete your own account',
    );
    await this.validateU15_LastSystemAdmin(targetUserId, qr);
    await this.validateU16_PrimaryOrgUnitHead(targetUserId, qr);
  }

  /**
   * Validation for Role Assignment (§6 & §7 & §9.1).
   */
  async validateAssignRole(
    targetUserId: string,
    roleId: string,
    operatorUserId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    this.validateU14_SelfAction(
      targetUserId,
      operatorUserId,
      'assign roles to yourself',
    );

    const user = await this.usersRepository.findById(targetUserId, qr);
    if (!user) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_NOT_FOUND,
          error: USER_ERROR_CODES.USER_NOT_FOUND,
          message: 'Target user not found.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.validateV3_VendorRoles(user.userType, roleId, qr);
  }

  /**
   * Validation for Role Revocation (§9.1).
   */
  validateRevokeRole(targetUserId: string, operatorUserId?: string): void {
    this.validateU14_SelfAction(
      targetUserId,
      operatorUserId,
      'revoke your own roles',
    );
  }

  /**
   * Validation for Scope Assignment (§6 & §7 & §9.1).
   */
  async validateAssignScope(
    targetUserId: string,
    dto: AssignScopeDto,
    operatorUserId?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    this.validateU14_SelfAction(
      targetUserId,
      operatorUserId,
      'assign organizational scope to yourself',
    );

    const user = await this.usersRepository.findById(targetUserId, qr);
    if (!user) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.USER_NOT_FOUND,
          error: USER_ERROR_CODES.USER_NOT_FOUND,
          message: 'Target user not found.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    this.validateS5_VendorScopeRestriction(user.userType);
    this.validateV4_VendorScope(user.userType);

    // Look up ScopeCode from ScopeDefinitionID
    const scopeDefRows = await this.getExecutor(qr).query(
      `
      SELECT ScopeCode
      FROM [auth].[ScopeDefinitions]
      WHERE ScopeDefinitionID = @0;
      `,
      [dto.scopeDefinitionId],
    );

    if (!scopeDefRows || scopeDefRows.length === 0) {
      throw new HttpException(
        {
          code: USER_ERROR_CODES.SCOPE_NOT_FOUND,
          error: USER_ERROR_CODES.SCOPE_NOT_FOUND,
          message: `ScopeDefinition [${dto.scopeDefinitionId}] not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const scopeCode = scopeDefRows[0].ScopeCode;
    const referencedOrgUnitId = this.validateS1_ScopeColumns(scopeCode, dto);

    if (referencedOrgUnitId) {
      await this.validateS2_ScopeOrgUnitType(
        scopeCode,
        referencedOrgUnitId,
        qr,
      );
    }

    await this.validateS3_GlobalScopeGrant(scopeCode, operatorUserId, qr);
    await this.validateS4_ScopeEscalation(
      scopeCode,
      referencedOrgUnitId,
      operatorUserId,
      qr,
    );
    await this.validateS6_DuplicateScope(
      targetUserId,
      dto.scopeDefinitionId,
      referencedOrgUnitId,
      qr,
    );
  }

  /**
   * Validation for Scope Revocation (§6 & §9.1).
   */
  validateRevokeScope(
    targetUserId: string,
    operatorUserId?: string,
    activeScopeCount: number = 0,
  ): void {
    this.validateU14_SelfAction(
      targetUserId,
      operatorUserId,
      'revoke your own scope',
    );
    this.validateS8_SelfScopeRemoval(
      targetUserId,
      operatorUserId,
      activeScopeCount,
    );
  }

  /**
   * Validation for Override Creation / Management (§9.1).
   */
  validateManageOverride(targetUserId: string, operatorUserId?: string): void {
    this.validateU14_SelfAction(
      targetUserId,
      operatorUserId,
      'grant or revoke permission overrides on your own account',
    );
  }
}
