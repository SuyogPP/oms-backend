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
    const userOrgScopeId = await this.userScopesRepository.assignScope({
      userId,
      scopeDefinitionId: dto.scopeDefinitionId,
      orgUnitId: dto.orgUnitId,
      organizationId: dto.organizationId,
      businessUnitId: dto.businessUnitId,
      departmentId: dto.departmentId,
      sectionId: dto.sectionId,
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

    return assignment;
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
    const rows = await this.dataSource.query(
      `
      SELECT ScopeCode
      FROM [auth].[ScopeDefinitions]
      WHERE ScopeDefinitionID = @0;
      `,
      [scopeDefinitionId],
    );

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
      WHERE s.UserID = @0
        AND sd.ScopeCode = 'GLOBAL'
        AND (s.IsActive = 1 OR s.IsActive IS NULL)
        AND (s.EffectiveFrom IS NULL OR s.EffectiveFrom <= SYSUTCDATETIME())
        AND (s.EffectiveTo IS NULL OR s.EffectiveTo > SYSUTCDATETIME());
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
