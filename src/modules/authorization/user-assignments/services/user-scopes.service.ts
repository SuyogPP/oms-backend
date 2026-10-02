import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserScopesRepository } from '../repositories/user-scopes.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { UserValidationService } from '../../users/services/user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { AssignScopeDto, ScopeCountResponseDto } from '../dto/assign-scope.dto';
import { IUserScopeAssignment } from '../interfaces/user-assignments.interface';
import { USER_ERROR_CODES } from '../../users/users.constants';

@Injectable()
export class UserScopesService {
  private readonly logger = new Logger(UserScopesService.name);

  constructor(
    private readonly userScopesRepository: UserScopesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly userValidationService: UserValidationService,
    private readonly securityEventsService: SecurityEventsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Retrieves all scope assignments for a user, enforcing organizational scope (§9.2).
   */
  async findByUserId(
    userId: string,
    requesterUserId?: string,
  ): Promise<IUserScopeAssignment[]> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found.`,
      });
    }

    if (requesterUserId) {
      await this.enforceScopeVisibility(userId, requesterUserId, user);
    }

    return this.userScopesRepository.findByUserId(userId);
  }

  /**
   * Assigns an organizational scope to a user (§6.1, §6.2 Rules S1-S6).
   *
   * Enforced Invariants:
   * - S1: exactly one scope column populated matching ScopeDefinitionID
   * - S2: referenced org unit must exist, be active, and match type
   * - S3: granting GLOBAL requires SYSTEM_ADMIN
   * - S4: CANNOT GRANT SCOPE BROADER THAN YOUR OWN
   * - S5: vendor users get no organizational scope
   * - S6: duplicate active scope for the same unit rejected
   * - U14 / 9.1: cannot assign scope to yourself
   */
  async assignScope(
    userId: string,
    dto: AssignScopeDto,
    operatorUserId?: string,
  ): Promise<IUserScopeAssignment> {
    // 1. Full validation suite (S1-S6 + U14)
    await this.userValidationService.validateAssignScope(
      userId,
      dto,
      operatorUserId,
    );

    // 2. Persist temporal scope assignment
    // Map generic orgUnitId to the specific column if not already populated
    const scopeRows = await this.dataSource.query(
      `SELECT ScopeCode FROM [auth].[ScopeDefinitions] WHERE ScopeDefinitionID = @0`,
      [dto.scopeDefinitionId],
    );
    const scopeCode = scopeRows?.[0]?.ScopeCode;

    const effectiveOrgUnitId =
      dto.orgUnitId ||
      dto.departmentId ||
      dto.businessUnitId ||
      dto.organizationId ||
      dto.sectionId ||
      undefined;

    let organizationId: string | undefined = dto.organizationId;
    let businessUnitId: string | undefined = dto.businessUnitId;
    let departmentId: string | undefined = dto.departmentId;
    let sectionId: string | undefined = dto.sectionId;

    if (scopeCode === 'ORGANIZATION') organizationId = organizationId || effectiveOrgUnitId;
    if (scopeCode === 'BUSINESS_UNIT') businessUnitId = businessUnitId || effectiveOrgUnitId;
    if (scopeCode === 'DEPARTMENT') departmentId = departmentId || effectiveOrgUnitId;
    if (scopeCode === 'SECTION') sectionId = sectionId || effectiveOrgUnitId;

    const userOrgScopeId = await this.userScopesRepository.assignScope({
      userId,
      scopeDefinitionId: dto.scopeDefinitionId,
      orgUnitId: effectiveOrgUnitId,
      organizationId,
      businessUnitId,
      departmentId,
      sectionId,
      effectiveFrom: dto.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : new Date(),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
    });

    const assignment = await this.userScopesRepository.findById(userOrgScopeId);
    if (!assignment) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.SCOPE_NOT_FOUND,
        message: 'Assigned scope record not found after creation.',
      });
    }

    // 3. Security Event & Audit Log
    await this.securityEventsService.log('SCOPE_ASSIGNED', {
      userId,
      description: `Organizational scope [${assignment.scopeCode}] assigned to user [${userId}] by [${operatorUserId || 'SYSTEM'}]. Effective: ${assignment.effectiveFrom ? assignment.effectiveFrom.toISOString() : 'IMMEDIATE'} to ${assignment.effectiveTo ? assignment.effectiveTo.toISOString() : 'INDEFINITE'}.`,
    });

    await this.auditService.logUserUpdated({
      userId,
      updatedFields: {
        assignedScope: assignment.scopeCode,
        orgUnitId: assignment.orgUnitId,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo,
        assignedBy: operatorUserId,
      },
    });

    // 4. Synchronize leadership manager and profile department for organizational alignment
    await this.syncLeadershipManager(userId, effectiveOrgUnitId);

    return assignment;
  }

  private async syncLeadershipManager(
    userId: string,
    orgUnitId?: string,
  ): Promise<void> {
    if (!orgUnitId) return;
    try {
      const roles: any[] = await this.dataSource.query(
        `SELECT r.role_code 
         FROM auth.tbl_User_Roles ur 
         INNER JOIN auth.tbl_Roles r ON r.role_id = ur.role_id 
         WHERE ur.user_id = @0 AND r.role_code IN ('HOD', 'SECTION_HEAD')`,
        [userId],
      );
      if (roles.length > 0) {
        await this.dataSource.query(
          `UPDATE org.OrgUnits SET HeadUserId = @0 WHERE OrgUnitId = @1`,
          [userId, orgUnitId],
        );
        const existing: any[] = await this.dataSource.query(
          `SELECT OrgUnitManagerId FROM org.OrgUnitManagers 
           WHERE OrgUnitId = @0 AND UserId = @1 AND manager_role_code = 'HEAD' AND IsDeleted = 0`,
          [orgUnitId, userId],
        );
        if (existing.length === 0) {
          await this.dataSource.query(
            `INSERT INTO org.OrgUnitManagers (
               OrgUnitManagerId, OrgUnitId, UserId, ManagerRoleCode, IsPrimary, 
               EffectiveFrom, AssignmentReason, IsActive, IsDeleted, CreatedBy, CreatedAt
             ) VALUES (
               NEWID(), @0, @1, 'HEAD', 1, 
               CAST(GETDATE() AS DATE), 'Auto-synced from User Administration HOD assignment', 1, 0, 'SYSTEM', GETUTCDATE()
             )`,
            [orgUnitId, userId],
          );
        } else {
          await this.dataSource.query(
            `UPDATE org.OrgUnitManagers SET is_active = 1, IsPrimary = 1 WHERE OrgUnitManagerId = @0`,
            [existing[0].OrgUnitManagerId],
          );
        }
      }
      const unitTypes: any[] = await this.dataSource.query(
        `SELECT t.Code FROM org.OrgUnits u INNER JOIN org.OrgUnitTypes t ON t.OrgUnitTypeId = u.OrgUnitTypeId WHERE u.OrgUnitId = @0`,
        [orgUnitId],
      );
      const typeCode = unitTypes?.[0]?.Code;
      if (typeCode === 'DEPARTMENT') {
        await this.dataSource.query(
          `UPDATE auth.UserProfiles SET DepartmentID = @0 WHERE user_id = @1`,
          [orgUnitId, userId],
        );
      } else if (typeCode === 'BUSINESS_UNIT') {
        await this.dataSource.query(
          `UPDATE auth.UserProfiles SET BusinessUnitID = @0 WHERE user_id = @1`,
          [orgUnitId, userId],
        );
      } else if (typeCode === 'SECTION') {
        await this.dataSource.query(
          `UPDATE auth.UserProfiles SET SectionID = @0 WHERE user_id = @1`,
          [orgUnitId, userId],
        );
      }
    } catch (err) {
      this.logger.error(`Failed to sync leadership manager for user [${userId}] on org unit [${orgUnitId}]:`, err);
    }
  }

  /**
   * Revokes an organizational scope assignment (§6.2 Rules S7 & S8, §9.1).
   *
   * Enforced Invariants:
   * - S7: Revocation sets EffectiveTo = now, NEVER hard deletes.
   * - S8: Cannot remove your own last remaining scope.
   * - U14 / 9.1: Cannot revoke your own scopes.
   */
  async revokeScope(
    userOrganizationScopeId: string,
    operatorUserId?: string,
  ): Promise<void> {
    const assignment = await this.userScopesRepository.findById(
      userOrganizationScopeId,
    );
    if (!assignment) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.SCOPE_NOT_FOUND,
        message: `Scope assignment [${userOrganizationScopeId}] not found.`,
      });
    }

    // Self-Action & Last Scope Validation (U14 & S8)
    const activeCount = await this.userScopesRepository.countActiveByUserId(
      assignment.userId,
    );
    this.userValidationService.validateRevokeScope(
      assignment.userId,
      operatorUserId,
      activeCount,
    );

    // S7: Sets EffectiveTo = now (never hard delete)
    await this.userScopesRepository.revokeScope(userOrganizationScopeId);

    // Security Event & Audit Log
    await this.securityEventsService.log('SCOPE_REVOKED', {
      userId: assignment.userId,
      description: `Scope assignment [${assignment.scopeCode}] (ScopeID: ${userOrganizationScopeId}) revoked by [${operatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserUpdated({
      userId: assignment.userId,
      updatedFields: {
        revokedScope: assignment.scopeCode,
        userOrganizationScopeId,
        revokedBy: operatorUserId,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Helper returning the count of active org units a proposed scope would grant access to.
   * Gives immediate numerical feedback in the administrative UI.
   */
  async countProposedScopeUnits(
    scopeDefinitionId: string,
    orgUnitId?: string | null,
  ): Promise<ScopeCountResponseDto> {
    let rows = await this.dataSource.query(
      `
      SELECT ScopeCode
      FROM [auth].[ScopeDefinitions]
      WHERE ScopeDefinitionID = @0;
      `,
      [scopeDefinitionId],
    );

    if (!rows || rows.length === 0) {
      const PLACEHOLDER_MAP: Record<string, string> = {
        '3053433E-F36B-1410-85ED-009A959FB341': 'GLOBAL',
        '3053433E-F36B-1410-85ED-009A959FB342': 'BUSINESS_UNIT',
        '3053433E-F36B-1410-85ED-009A959FB343': 'DEPARTMENT',
        '3053433E-F36B-1410-85ED-009A959FB344': 'SECTION',
        'GLOBAL': 'GLOBAL',
        'ORGANIZATION': 'ORGANIZATION',
        'BUSINESS_UNIT': 'BUSINESS_UNIT',
        'DEPARTMENT': 'DEPARTMENT',
        'SECTION': 'SECTION',
      };
      const candidateCode = PLACEHOLDER_MAP[scopeDefinitionId?.trim().toUpperCase()];
      if (candidateCode) {
        rows = await this.dataSource.query(
          `
          SELECT ScopeCode
          FROM [auth].[ScopeDefinitions]
          WHERE UPPER(ScopeCode) = @0;
          `,
          [candidateCode],
        );
      }
    }

    if (!rows || rows.length === 0) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.SCOPE_NOT_FOUND,
        message: `ScopeDefinition [${scopeDefinitionId}] not found.`,
      });
    }

    const scopeCode = rows[0].ScopeCode;
    const count = await this.userScopesRepository.countUnitsInScope(
      scopeCode,
      orgUnitId || null,
    );

    return {
      accessibleOrgUnitsCount: count,
      scopeCode,
      orgUnitId: orgUnitId || null,
    };
  }

  /**
   * Retrieves all system scope definitions.
   */
  async getScopeDefinitions(): Promise<
    Array<{ scopeDefinitionId: string; scopeCode: string; scopeName: string }>
  > {
    return this.dataSource.query(`
      SELECT 
        ScopeDefinitionID AS scopeDefinitionId,
        ScopeCode AS scopeCode,
        ScopeName AS scopeName
      FROM [auth].[ScopeDefinitions]
    `);
  }

  /**
   * Scope Visibility Helper (§9.2): Returns 404 on out-of-scope access.
   */
  private async enforceScopeVisibility(
    targetUserId: string,
    requesterUserId: string,
    targetUser: any,
  ): Promise<void> {
    const globalScopeRows = await this.dataSource.query(
      `
      SELECT 1 FROM [auth].[UserOrganizationScopes] s
      INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
      WHERE s.user_id = @0
        AND sd.ScopeCode = 'GLOBAL'
        AND (s.is_active = 1 OR s.is_active IS NULL)
        AND (s.effective_from IS NULL OR s.effective_from <= SYSUTCDATETIME())
        AND (s.effective_to IS NULL OR s.effective_to > SYSUTCDATETIME());
      `,
      [requesterUserId],
    );

    if (globalScopeRows && globalScopeRows.length > 0) {
      return;
    }

    const deptId = targetUser.profile?.departmentId;
    if (!deptId) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${targetUserId}] not found.`,
      });
    }

    const visibleRows = await this.dataSource.query(
      `
      SELECT 1 FROM [org].[fn_VisibleOrgUnits](@0)
      WHERE OrgUnitId = @1;
      `,
      [requesterUserId, deptId],
    );

    if (!visibleRows || visibleRows.length === 0) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${targetUserId}] not found.`,
      });
    }
  }
}
