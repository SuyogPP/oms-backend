import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsersRepository } from '../repositories/users.repository';
import { UserRolesRepository } from '../../user-assignments/repositories/user-roles.repository';
import { DelegationsRepository } from '../../delegations/repositories/delegations.repository';
import { UserValidationService } from './user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { USER_ERROR_CODES } from '../users.constants';

@Injectable()
export class UserLifecycleService {
  private readonly logger = new Logger(UserLifecycleService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly userRolesRepository: UserRolesRepository,
    private readonly delegationsRepository: DelegationsRepository,
    private readonly userValidationService: UserValidationService,
    private readonly securityEventsService: SecurityEventsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Activates an inactive user.
   */
  async activate(userId: string, operatorUserId?: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found or has been deleted.`,
      });
    }

    if (user.isActive) {
      return; // Already active (idempotent)
    }

    await this.usersRepository.activate(userId);

    // Audit and Security events
    await this.securityEventsService.log('USER_ACTIVATED', {
      userId,
      description: `User [${user.username}] was activated by operator [${operatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserStatusChanged({
      userId,
      isActive: true,
      reason: 'User account activated',
    });
  }

  /**
   * Deactivates a user (§5.5 & §9.1).
   *
   * Rules:
   * - Validates U14 (no self-deactivation)
   * - Validates U15 (cannot deactivate the last active SYSTEM_ADMIN)
   * - Sets auth.Users.IsActive = 0
   * - Revokes all active sessions immediately
   * - Preserves roles and scopes per U12 (reactivation must restore the user exactly as they were)
   */
  async deactivate(userId: string, operatorUserId?: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found or has been deleted.`,
      });
    }

    // Run security validations (U14 & U15)
    await this.userValidationService.validateDeactivateUser(userId, operatorUserId);

    if (!user.isActive) {
      return; // Already inactive (idempotent)
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Deactivate user in auth.Users
      await this.usersRepository.deactivate(userId, queryRunner);

      // 2. Revoke active sessions immediately
      await this.usersRepository.revokeAllUserSessions(
        userId,
        'Account deactivated by administrator',
        queryRunner,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Audit and Security events
    await this.securityEventsService.log('USER_DEACTIVATED', {
      userId,
      description: `User [${user.username}] was deactivated by operator [${operatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserStatusChanged({
      userId,
      isActive: false,
      reason: 'User account deactivated',
    });
  }

  /**
   * Soft deletes a user (§5.5 & §9.1).
   *
   * Rules:
   * - Validates U14 (no self-deletion)
   * - Validates U15 (cannot delete the last active SYSTEM_ADMIN)
   * - Validates U16 (cannot delete a user who is current primary head of an active org unit)
   * - Transactional:
   *   1. Soft delete auth.Users (IsDeleted = 1, DeletedAt = now, DeletedBy = operator, IsActive = 0)
   *   2. Revoke active sessions
   *   3. End active roles (EffectiveTo = now, IsActive = 0)
   *   4. End active delegations (EndDate = now, IsActive = 0)
   */
  async softDelete(userId: string, operatorUserId?: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found or already deleted.`,
      });
    }

    // Run security validations (U14, U15, U16)
    await this.userValidationService.validateDeleteUser(userId, operatorUserId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Soft delete user
      await this.usersRepository.softDelete(userId, operatorUserId, queryRunner);

      // 2. Revoke active sessions
      await this.usersRepository.revokeAllUserSessions(
        userId,
        'Account deleted by administrator',
        queryRunner,
      );

      // 3. End all active roles
      await this.userRolesRepository.revokeAllForUser(userId, queryRunner);

      // 4. End all active delegations
      await this.delegationsRepository.endAllForUser(userId, queryRunner);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Audit and Security events
    await this.securityEventsService.log('USER_DELETED', {
      userId,
      description: `User [${user.username}] was soft-deleted by operator [${operatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserDeleted({
      userId,
    });
  }
}
