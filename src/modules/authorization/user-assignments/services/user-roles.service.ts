import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserRolesRepository } from '../repositories/user-roles.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { UserValidationService } from '../../users/services/user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { IUserRoleAssignment } from '../interfaces/user-assignments.interface';
import { USER_ERROR_CODES } from '../../users/users.constants';

@Injectable()
export class UserRolesService {
  private readonly logger = new Logger(UserRolesService.name);

  constructor(
    private readonly userRolesRepository: UserRolesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly userValidationService: UserValidationService,
    private readonly securityEventsService: SecurityEventsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Retrieves all role assignments for a user, enforcing organizational scope (§9.2).
   */
  async findByUserId(
    userId: string,
    requesterUserId?: string,
  ): Promise<IUserRoleAssignment[]> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found.`,
      });
    }

    // Scope check: If requester is specified, verify target user is visible in requester scope
    if (requesterUserId) {
      await this.enforceScopeVisibility(userId, requesterUserId, user);
    }

    return this.userRolesRepository.findByUserId(userId);
  }

  /**
   * Retrieves all active master roles.
   */
  async findAllRoles() {
    return this.userRolesRepository.findAllRoles();
  }

  /**
   * Assigns a role to a user with temporal boundaries (§4.2, §8, §9.1, V3).
   *
   * Invariants:
   * - Requires USER.ROLE.ASSIGN (SYSTEM_ADMIN only).
   * - Cannot assign roles to yourself (9.1 / U14).
   * - Vendor users cannot receive internal roles (V3).
   * - Future-dated assignments are allowed (EffectiveFrom > now).
   * - Writes auth.SecurityEvents and audit logs.
   */
  async assignRole(
    userId: string,
    dto: AssignRoleDto,
    operatorUserId?: string,
  ): Promise<IUserRoleAssignment> {
    // Resolve role by UUID or RoleCode
    const role = await this.userRolesRepository.findRoleByIdOrCode(dto.roleId);
    if (!role) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.ROLE_NOT_FOUND,
        message: `Role [${dto.roleId}] not found in system roles registry.`,
      });
    }

    // 1. Full validation (Self-action U14, User existence, Vendor restriction V3)
    await this.userValidationService.validateAssignRole(
      userId,
      role.roleId,
      operatorUserId,
    );

    // 2. Persist temporal role assignment
    const userRoleId = await this.userRolesRepository.assignRole({
      userId,
      roleId: role.roleId,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      assignedBy: operatorUserId,
    });

    const assignment = await this.userRolesRepository.findById(userRoleId);
    if (!assignment) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.ROLE_NOT_FOUND,
        message: 'Assigned role record not found after creation.',
      });
    }

    // 3. Record Security Event and Audit Log
    await this.securityEventsService.log('ROLE_ASSIGNED', {
      userId,
      description: `Role [${assignment.roleCode}] assigned to user [${userId}] by [${operatorUserId || 'SYSTEM'}]. Effective: ${assignment.effectiveFrom.toISOString()} to ${assignment.effectiveTo ? assignment.effectiveTo.toISOString() : 'INDEFINITE'}.`,
    });

    await this.auditService.logUserUpdated({
      userId,
      updatedFields: {
        assignedRole: assignment.roleCode,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo,
        assignedBy: operatorUserId,
      },
    });

    return assignment;
  }

  /**
   * Revokes a role assignment by setting EffectiveTo = now (§4.2, §8, §9.1).
   *
   * Invariants:
   * - Sets EffectiveTo = now. Does NOT set IsActive = 0 per section 4.2.
   * - Cannot revoke your own roles (9.1 / U14).
   * - Writes auth.SecurityEvents and audit logs.
   */
  async revokeRole(
    userRoleId: string,
    operatorUserId?: string,
  ): Promise<void> {
    const assignment = await this.userRolesRepository.findById(userRoleId);
    if (!assignment) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.ROLE_NOT_FOUND,
        message: `Role assignment [${userRoleId}] not found.`,
      });
    }

    // Self-Action Prevention (9.1 / U14)
    if (operatorUserId && assignment.userId === operatorUserId) {
      throw new ConflictException({
        code: USER_ERROR_CODES.USER_SELF_ACTION,
        message: 'Cannot revoke your own role assignments.',
      });
    }

    // Revocation: Sets EffectiveTo = now. Preserves IsActive per Section 4.2.
    await this.userRolesRepository.revokeRole(userRoleId);

    // Record Security Event & Audit Log
    await this.securityEventsService.log('ROLE_REVOKED', {
      userId: assignment.userId,
      description: `Role assignment [${assignment.roleCode}] (UserRoleID: ${userRoleId}) revoked by [${operatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserUpdated({
      userId: assignment.userId,
      updatedFields: {
        revokedRole: assignment.roleCode,
        userRoleId,
        revokedBy: operatorUserId,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Helper: Enforces that target user is visible within requester's organizational scope (§9.2).
   * Returns 404 (never 403) on out-of-scope.
   */
  private async enforceScopeVisibility(
    targetUserId: string,
    requesterUserId: string,
    targetUser: any,
  ): Promise<void> {
    // Check if requester holds GLOBAL scope
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
      // If user has no department and requester is not global admin -> 404
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
