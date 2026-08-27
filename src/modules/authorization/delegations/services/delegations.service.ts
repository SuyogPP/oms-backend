import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DelegationsRepository } from '../repositories/delegations.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { CreateDelegationDto, UpdateDelegationDto } from '../dto/create-delegation.dto';
import { IDelegation } from '../interfaces/delegations.interface';
import { USER_ERROR_CODES, USER_TYPES, USER_PERMISSIONS } from '../../users/users.constants';

@Injectable()
export class DelegationsService {
  private readonly logger = new Logger(DelegationsService.name);

  constructor(
    private readonly delegationsRepository: DelegationsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly securityEventsService: SecurityEventsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Retrieves all delegations granted by a user, enforcing organizational scope (§9.2).
   */
  async findByUserId(
    userId: string,
    requesterUserId?: string,
  ): Promise<IDelegation[]> {
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

    return this.delegationsRepository.findByFromUserId(userId);
  }

  /**
   * Retrieves delegations granted by AND received by the calling user (GET /me/delegations).
   */
  async findMyDelegations(
    userId: string,
  ): Promise<{ granted: IDelegation[]; received: IDelegation[] }> {
    const granted = await this.delegationsRepository.findByFromUserId(userId);
    const received = await this.delegationsRepository.findByToUserId(userId);

    return {
      granted,
      received,
    };
  }

  /**
   * Creates a delegation of authority enforcing Rules D1-D7 (§9.3).
   *
   * G6 Decision:
   * Option (b) - Permission-Scoped Delegation (via auth.DelegationPermissions) with
   * fallback to Option (a) all-or-nothing delegation if no permissions are specified.
   *
   * Rules Enforced:
   * - D1: FromUserID != ToUserID
   * - D2: EndDate > StartDate, max duration 90 days
   * - D3: No overlapping active delegations from the same user
   * - D4: Delegate must be active and INTERNAL
   * - D5: No chained delegation
   * - D6: Dual identity audit logging (records both acting operator and delegator)
   * - D7: Expiry evaluated at request time
   */
  async create(
    fromUserId: string,
    dto: CreateDelegationDto,
    operatorUserId?: string,
  ): Promise<IDelegation> {
    // 1. Mandatory Reason
    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException({
        code: 'DELEGATION_REASON_REQUIRED',
        message: 'A stated business justification is mandatory for creating delegations.',
      });
    }

    // 2. Authorization Guard: Managing own delegation vs another user's
    const isSelfManagement = operatorUserId === fromUserId;
    if (!isSelfManagement && operatorUserId) {
      const isAuthorized = await this.hasDelegationManagePermission(
        operatorUserId,
      );
      if (!isAuthorized) {
        throw new ForbiddenException({
          code: 'DELEGATION_MANAGE_FORBIDDEN',
          message:
            'You can only create delegations for your own account unless you hold USER.DELEGATION.MANAGE permission.',
        });
      }
    }

    // 3. D1: Self-delegation forbidden
    if (fromUserId === dto.toUserId) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.DELEGATION_SELF_NOT_ALLOWED,
        message: 'Cannot delegate authority to yourself.',
      });
    }

    // 4. D2: Date validation & max 90 days
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.DELEGATION_INVALID_DATES,
        message: 'End date must be strictly after start date.',
      });
    }

    const durationDays =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (durationDays > 90) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.DELEGATION_INVALID_DATES,
        message: 'Delegation duration cannot exceed 90 days.',
      });
    }

    // 5. D3: No overlapping active delegations from the same user
    const hasOverlap =
      await this.delegationsRepository.hasActiveOverlappingDelegation(
        fromUserId,
        startDate,
        endDate,
      );
    if (hasOverlap) {
      throw new ConflictException({
        code: USER_ERROR_CODES.DELEGATION_OVERLAP,
        message:
          'An active delegation already exists covering this date range for the delegator.',
      });
    }

    // 6. D4: Delegate must be active and INTERNAL
    const delegate = await this.usersRepository.findById(dto.toUserId);
    if (
      !delegate ||
      delegate.isDeleted ||
      !delegate.isActive ||
      delegate.userType !== USER_TYPES.INTERNAL
    ) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.DELEGATION_INVALID_DELEGATE,
        message:
          'Delegate must be an active internal user. Vendor and service accounts cannot receive delegations.',
      });
    }

    // 7. D5: No chained delegation
    const fromIsActing =
      await this.delegationsRepository.isCurrentlyActingDelegate(fromUserId);
    if (fromIsActing) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.DELEGATION_CHAINED_NOT_ALLOWED,
        message:
          'Users currently acting as delegates cannot re-delegate authority.',
      });
    }

    const toIsActing =
      await this.delegationsRepository.isCurrentlyActingDelegate(dto.toUserId);
    if (toIsActing) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.DELEGATION_CHAINED_NOT_ALLOWED,
        message:
          'Cannot delegate to a user who is currently acting as a delegate in an active delegation.',
      });
    }

    // 8. Persist Delegation (Option b: with optional permission bounds)
    const delegationId = await this.delegationsRepository.create({
      fromUserId,
      toUserId: dto.toUserId,
      startDate,
      endDate,
      reason: dto.reason.trim(),
      permissionIds: dto.permissionIds,
    });

    const created = await this.delegationsRepository.findById(delegationId);
    if (!created) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.DELEGATION_NOT_FOUND,
        message: 'Created delegation record not found.',
      });
    }

    // 9. D6: Record Dual-Identity Security Event & Audit Log
    await this.securityEventsService.log('DELEGATION_CREATED', {
      userId: fromUserId,
      description: `Delegation created from [${fromUserId}] to [${dto.toUserId}] by [${operatorUserId || fromUserId}]. Reason: "${dto.reason}". Duration: ${startDate.toISOString()} to ${endDate.toISOString()}.`,
    });

    await this.auditService.logUserUpdated({
      userId: fromUserId,
      updatedFields: {
        action: 'DELEGATION_CREATED',
        delegationId,
        delegatorUserId: fromUserId,
        delegateUserId: dto.toUserId,
        operatorUserId: operatorUserId || fromUserId,
        startDate,
        endDate,
        reason: dto.reason,
        permissionIds: dto.permissionIds || null,
      },
    });

    return created;
  }

  /**
   * Updates an existing delegation.
   */
  async update(
    delegationId: string,
    dto: UpdateDelegationDto,
    operatorUserId?: string,
  ): Promise<IDelegation> {
    const delegation = await this.delegationsRepository.findById(delegationId);
    if (!delegation) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.DELEGATION_NOT_FOUND,
        message: `Delegation [${delegationId}] not found.`,
      });
    }

    // Authorization Guard
    const isOwner = operatorUserId === delegation.fromUserId;
    if (!isOwner && operatorUserId) {
      const isAuthorized = await this.hasDelegationManagePermission(
        operatorUserId,
      );
      if (!isAuthorized) {
        throw new ForbiddenException({
          code: 'DELEGATION_MANAGE_FORBIDDEN',
          message:
            'You can only modify your own delegations unless you hold USER.DELEGATION.MANAGE permission.',
        });
      }
    }

    if (dto.endDate) {
      const newEndDate = new Date(dto.endDate);
      if (newEndDate <= delegation.startDate) {
        throw new BadRequestException({
          code: USER_ERROR_CODES.DELEGATION_INVALID_DATES,
          message: 'End date must be strictly after delegation start date.',
        });
      }

      const durationDays =
        (newEndDate.getTime() - delegation.startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      if (durationDays > 90) {
        throw new BadRequestException({
          code: USER_ERROR_CODES.DELEGATION_INVALID_DATES,
          message: 'Delegation duration cannot exceed 90 days.',
        });
      }

      const hasOverlap =
        await this.delegationsRepository.hasActiveOverlappingDelegation(
          delegation.fromUserId,
          delegation.startDate,
          newEndDate,
          delegationId,
        );
      if (hasOverlap) {
        throw new ConflictException({
          code: USER_ERROR_CODES.DELEGATION_OVERLAP,
          message: 'Updated end date creates an overlap with another active delegation.',
        });
      }
    }

    await this.delegationsRepository.update(delegationId, dto);

    const updated = await this.delegationsRepository.findById(delegationId);

    await this.securityEventsService.log('DELEGATION_UPDATED', {
      userId: delegation.fromUserId,
      description: `Delegation [${delegationId}] updated by [${operatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserUpdated({
      userId: delegation.fromUserId,
      updatedFields: {
        action: 'DELEGATION_UPDATED',
        delegationId,
        delegatorUserId: delegation.fromUserId,
        delegateUserId: delegation.toUserId,
        operatorUserId: operatorUserId || delegation.fromUserId,
        updatedEndDate: dto.endDate,
        updatedReason: dto.reason,
        isActive: dto.isActive,
      },
    });

    return updated!;
  }

  /**
   * Cancels/ends an active delegation immediately.
   */
  async cancel(delegationId: string, operatorUserId?: string): Promise<void> {
    const delegation = await this.delegationsRepository.findById(delegationId);
    if (!delegation) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.DELEGATION_NOT_FOUND,
        message: `Delegation [${delegationId}] not found.`,
      });
    }

    // Authorization Guard
    const isOwner = operatorUserId === delegation.fromUserId;
    if (!isOwner && operatorUserId) {
      const isAuthorized = await this.hasDelegationManagePermission(
        operatorUserId,
      );
      if (!isAuthorized) {
        throw new ForbiddenException({
          code: 'DELEGATION_MANAGE_FORBIDDEN',
          message:
            'You can only cancel your own delegations unless you hold USER.DELEGATION.MANAGE permission.',
        });
      }
    }

    await this.delegationsRepository.cancel(delegationId);

    await this.securityEventsService.log('DELEGATION_CANCELLED', {
      userId: delegation.fromUserId,
      description: `Delegation [${delegationId}] from [${delegation.fromUserId}] to [${delegation.toUserId}] cancelled by [${operatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserUpdated({
      userId: delegation.fromUserId,
      updatedFields: {
        action: 'DELEGATION_CANCELLED',
        delegationId,
        delegatorUserId: delegation.fromUserId,
        delegateUserId: delegation.toUserId,
        operatorUserId: operatorUserId || delegation.fromUserId,
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Checks if user holds USER.DELEGATION.MANAGE permission or is SYSTEM_ADMIN.
   */
  private async hasDelegationManagePermission(
    userId: string,
  ): Promise<boolean> {
    const rows = await this.dataSource.query(
      `
      SELECT 1 FROM [auth].[UserRoles] ur
      INNER JOIN [auth].[RolePermissions] rp ON rp.RoleID = ur.RoleID
      INNER JOIN [auth].[Permissions] p ON p.PermissionID = rp.PermissionID
      INNER JOIN [auth].[Roles] r ON r.RoleID = ur.RoleID
      WHERE ur.UserID = @0
        AND ur.IsActive = 1
        AND r.IsActive = 1
        AND (r.RoleCode = 'SYSTEM_ADMIN' OR p.PermissionCode = @1)
        AND ur.EffectiveFrom <= SYSUTCDATETIME()
        AND (ur.EffectiveTo IS NULL OR ur.EffectiveTo > SYSUTCDATETIME());
      `,
      [userId, USER_PERMISSIONS.DELEGATION_MANAGE],
    );

    return rows && rows.length > 0;
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
