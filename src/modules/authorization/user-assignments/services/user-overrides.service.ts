import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserOverridesRepository } from '../repositories/user-overrides.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { UserValidationService } from '../../users/services/user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { ManageOverrideDto } from '../dto/manage-override.dto';
import { IUserOverrideAssignment } from '../interfaces/user-assignments.interface';
import { USER_ERROR_CODES } from '../../users/users.constants';

@Injectable()
export class UserOverridesService {
  private readonly logger = new Logger(UserOverridesService.name);

  constructor(
    private readonly userOverridesRepository: UserOverridesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly userValidationService: UserValidationService,
    private readonly securityEventsService: SecurityEventsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Retrieves all overrides for a user, enforcing organizational scope (§9.2).
   */
  async findByUserId(
    userId: string,
    requesterUserId?: string,
  ): Promise<IUserOverrideAssignment[]> {
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

    return this.userOverridesRepository.findByUserId(userId);
  }

  /**
   * Grants or revokes an individual permission override for a user (§4.1, §4.4, §8, §9.1).
   *
   * Invariants:
   * - Requires USER.OVERRIDE.MANAGE (SYSTEM_ADMIN only).
   * - Cannot grant yourself an override (9.1 / U14).
   * - Reason is MANDATORY (unauditable without justification).
   * - Temporal bounds: EffectiveFrom and optional EffectiveTo.
   * - Writes auth.SecurityEvents with before and after state.
   */
  async createOverride(
    userId: string,
    dto: ManageOverrideDto,
    operatorUserId?: string,
  ): Promise<IUserOverrideAssignment> {
    // 1. Mandatory Reason Verification
    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException({
        code: 'OVERRIDE_REASON_REQUIRED',
        message: 'A stated business reason is mandatory for creating permission overrides.',
      });
    }

    // 2. Self-Action & User Validation (9.1 / U14)
    this.userValidationService.validateManageOverride(userId, operatorUserId);

    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `Target user [${userId}] not found.`,
      });
    }

    // 3. Verify Permission Exists
    const permRows = await this.dataSource.query(
      `
      SELECT PermissionID, PermissionCode, ModuleName, ActionName
      FROM [auth].[Permissions]
      WHERE PermissionID = @0;
      `,
      [dto.permissionId],
    );

    if (!permRows || permRows.length === 0) {
      throw new NotFoundException({
        code: 'PERMISSION_NOT_FOUND',
        message: `Permission [${dto.permissionId}] not found.`,
      });
    }

    const perm = permRows[0];

    // 4. Capture Before State for active overrides of this permission
    const existingOverrides = await this.userOverridesRepository.findActiveByUserId(userId);
    const beforeOverride = existingOverrides.find(
      (o) => o.permissionId === dto.permissionId,
    );

    // 5. Persist Override Assignment
    const overrideId = await this.userOverridesRepository.createOverride({
      userId,
      permissionId: dto.permissionId,
      isGranted: dto.isGranted,
      reason: dto.reason.trim(),
      approvedBy: operatorUserId,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
    });

    const assignment = await this.userOverridesRepository.findById(overrideId);
    if (!assignment) {
      throw new NotFoundException({
        code: 'OVERRIDE_NOT_FOUND',
        message: 'Created permission override record not found.',
      });
    }

    // 6. Record Security Event with before and after state in description and audit log
    const eventType = dto.isGranted ? 'OVERRIDE_GRANTED' : 'OVERRIDE_REVOKED';
    const beforeDesc = beforeOverride
      ? `Prior: [${beforeOverride.isGranted ? 'GRANT' : 'REVOKE'}]`
      : 'Prior: [NONE]';

    await this.securityEventsService.log(eventType, {
      userId,
      description: `Permission override [${perm.PermissionCode}] set to [${dto.isGranted ? 'GRANT' : 'REVOKE'}] (${beforeDesc}) for user [${user.username}] by [${operatorUserId || 'SYSTEM'}]. Reason: "${dto.reason}".`,
    });

    await this.auditService.logUserUpdated({
      userId,
      updatedFields: {
        permissionOverride: perm.PermissionCode,
        isGranted: dto.isGranted,
        reason: dto.reason,
        approvedBy: operatorUserId,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo,
        beforeState: beforeOverride
          ? {
              isGranted: beforeOverride.isGranted,
              reason: beforeOverride.reason,
              effectiveFrom: beforeOverride.effectiveFrom,
              effectiveTo: beforeOverride.effectiveTo,
            }
          : null,
        afterState: {
          isGranted: assignment.isGranted,
          reason: assignment.reason,
          approvedBy: operatorUserId,
          effectiveFrom: assignment.effectiveFrom,
          effectiveTo: assignment.effectiveTo,
        },
      },
    });

    return assignment;
  }

  /**
   * Revokes a permission override by setting EffectiveTo = now (§4.2, §8, §9.1).
   */
  async revokeOverride(
    userPermissionOverrideId: string,
    operatorUserId?: string,
  ): Promise<void> {
    const assignment = await this.userOverridesRepository.findById(
      userPermissionOverrideId,
    );
    if (!assignment) {
      throw new NotFoundException({
        code: 'OVERRIDE_NOT_FOUND',
        message: `Permission override [${userPermissionOverrideId}] not found.`,
      });
    }

    // Self-Action Prevention (9.1 / U14)
    if (operatorUserId && assignment.userId === operatorUserId) {
      throw new ConflictException({
        code: USER_ERROR_CODES.USER_SELF_ACTION,
        message: 'Cannot revoke permission overrides on your own account.',
      });
    }

    const beforeState = {
      isGranted: assignment.isGranted,
      reason: assignment.reason,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo,
    };

    // Revoke: Sets EffectiveTo = now
    await this.userOverridesRepository.revokeOverride(userPermissionOverrideId);

    const now = new Date();
    const afterState = {
      ...beforeState,
      effectiveTo: now,
    };

    // Record Security Event & Audit Log with before and after state
    await this.securityEventsService.log('OVERRIDE_REVOKED', {
      userId: assignment.userId,
      description: `Permission override [${assignment.permissionCode}] (ID: ${userPermissionOverrideId}) revoked by [${operatorUserId || 'SYSTEM'}]. EffectiveTo set to [${now.toISOString()}].`,
    });

    await this.auditService.logUserUpdated({
      userId: assignment.userId,
      updatedFields: {
        revokedOverrideId: userPermissionOverrideId,
        revokedPermission: assignment.permissionCode,
        revokedBy: operatorUserId,
        revokedAt: now,
        beforeState,
        afterState,
      },
    });
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
