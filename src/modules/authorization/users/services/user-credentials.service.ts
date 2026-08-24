import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { UsersRepository } from '../repositories/users.repository';
import { UserInvitationsRepository } from '../repositories/user-invitations.repository';
import { PasswordHistoryRepository } from '../repositories/password-history.repository';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import {
  USER_ERROR_CODES,
  INVITATION_PURPOSES,
  INVITATION_EXPIRY_DAYS,
  PASSWORD_RESET_EXPIRY_HOURS,
  PASSWORD_HISTORY_CHECK_COUNT,
  PASSWORD_HISTORY_MAX_COUNT,
} from '../users.constants';
import {
  AcceptInvitationDto,
  ValidateInvitationResponseDto,
  GenericSuccessResponseDto,
  InvitationDispatchResultDto,
} from '../dto/user-credentials.dto';

const GENERIC_INVALID_TOKEN_MESSAGE =
  'This link is no longer valid. Ask an administrator to send a new invitation.';

@Injectable()
export class UserCredentialsService {
  private readonly logger = new Logger(UserCredentialsService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly userInvitationsRepository: UserInvitationsRepository,
    private readonly passwordHistoryRepository: PasswordHistoryRepository,
    private readonly securityEventsService: SecurityEventsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Issues or re-sends an onboarding invitation token for a user (§5.2).
   */
  async inviteUser(
    userId: string,
    resend: boolean = false,
    operatorUserId?: string,
  ): Promise<InvitationDispatchResultDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found.`,
      });
    }

    if (user.isActive && !resend) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.USER_TYPE_INVALID,
        message: `User [${user.username}] is already active. Use password reset to re-issue credentials.`,
      });
    }

    // 1. Generate 32 bytes cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Revoke outstanding unconsumed INVITE tokens
      await this.userInvitationsRepository.revokeOutstanding(
        userId,
        INVITATION_PURPOSES.INVITE,
        queryRunner,
      );

      // 3. Store ONLY the SHA-256 hash
      await this.userInvitationsRepository.create(
        userId,
        tokenHash,
        INVITATION_PURPOSES.INVITE,
        expiresAt,
        operatorUserId,
        queryRunner,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // 4. Record security event (NEVER log the raw token!)
    await this.securityEventsService.log('INVITATION_SENT', {
      userId,
      description: `Onboarding invitation issued for user [${user.username}] by [${operatorUserId || 'SYSTEM'}].`,
    });

    return {
      success: true,
      message: 'Invitation issued successfully.',
      rawToken,
      expiresAt,
    };
  }

  /**
   * Validates an invitation or password reset token without consuming it (§5.2 & §8).
   * Constant-time safe against enumeration attacks.
   */
  async validateInvitationToken(
    rawToken: string,
  ): Promise<ValidateInvitationResponseDto> {
    if (!rawToken || rawToken.trim() === '') {
      throw new BadRequestException({
        code: USER_ERROR_CODES.INVITATION_INVALID_OR_EXPIRED,
        message: GENERIC_INVALID_TOKEN_MESSAGE,
      });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const record = await this.userInvitationsRepository.findByTokenHashWithUser(tokenHash);

    // Invariant generic check: non-existent, consumed, expired, or deleted user all return identical error
    if (
      !record ||
      record.invitation.consumedAt !== null ||
      record.invitation.expiresAt.getTime() <= Date.now() ||
      record.user.isDeleted
    ) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.INVITATION_INVALID_OR_EXPIRED,
        message: GENERIC_INVALID_TOKEN_MESSAGE,
      });
    }

    return {
      valid: true,
      purpose: record.invitation.purpose,
      username: record.user.username,
      email: record.user.email,
    };
  }

  /**
   * Accepts an invitation or password reset, enforcing password history & complexity (§5.2, §5.3).
   */
  async acceptInvitation(
    rawToken: string,
    dto: AcceptInvitationDto,
  ): Promise<GenericSuccessResponseDto> {
    if (!rawToken || rawToken.trim() === '') {
      throw new BadRequestException({
        code: USER_ERROR_CODES.INVITATION_INVALID_OR_EXPIRED,
        message: GENERIC_INVALID_TOKEN_MESSAGE,
      });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const record = await this.userInvitationsRepository.findByTokenHashWithUser(tokenHash);

    if (
      !record ||
      record.invitation.consumedAt !== null ||
      record.invitation.expiresAt.getTime() <= Date.now() ||
      record.user.isDeleted
    ) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.INVITATION_INVALID_OR_EXPIRED,
        message: GENERIC_INVALID_TOKEN_MESSAGE,
      });
    }

    const userId = record.user.userId;

    // 1. Password History Check: compare candidate against last 5 passwords (§5.3)
    const recentHistory = await this.passwordHistoryRepository.getRecent(
      userId,
      PASSWORD_HISTORY_CHECK_COUNT,
    );

    for (const historyItem of recentHistory) {
      const isMatch = await bcrypt.compare(dto.password, historyItem.passwordHash);
      if (isMatch) {
        throw new BadRequestException({
          code: USER_ERROR_CODES.PASSWORD_HISTORY_VIOLATION,
          message: 'Password has been used recently. Choose a different password.',
        });
      }
    }

    // 2. Hash password with bcrypt (12 salt rounds)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3. Upsert LocalCredentials
      await this.usersRepository.upsertLocalCredentials(
        userId,
        passwordHash,
        false,
        queryRunner,
      );

      // 4. Record PasswordHistory and prune beyond 24 entries
      await this.passwordHistoryRepository.add(userId, passwordHash, queryRunner);
      await this.passwordHistoryRepository.prune(
        userId,
        PASSWORD_HISTORY_MAX_COUNT,
        queryRunner,
      );

      // 5. Consume token (single-use)
      await this.userInvitationsRepository.markConsumed(
        record.invitation.invitationId,
        queryRunner,
      );

      // 6. Set user active & clear MustChangePassword flag
      await this.usersRepository.activate(userId, queryRunner);
      await this.usersRepository.setMustChangePassword(userId, false, queryRunner);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // 7. Record Security Events (NEVER log the raw password or token!)
    const eventType =
      record.invitation.purpose === INVITATION_PURPOSES.PASSWORD_RESET
        ? 'PASSWORD_RESET_COMPLETED'
        : 'INVITATION_ACCEPTED';

    await this.securityEventsService.log(eventType, {
      userId,
      description: `User [${record.user.username}] completed credential setup for purpose [${record.invitation.purpose}].`,
    });

    return {
      success: true,
      message: 'Password set and account activated successfully.',
    };
  }

  /**
   * Initiates an administrative password reset (§5.3).
   *
   * Security Invariants:
   * - ADMINS NEVER SET OR SEE A PASSWORD (no password argument).
   * - Issues a 1-hour PASSWORD_RESET token.
   * - Sets MustChangePassword = 1.
   * - Terminates all active sessions in auth.LoginSessions.
   * - Records auth.LogoutHistory with reason PASSWORD_RESET.
   */
  async resetPassword(
    userId: string,
    operatorUserId?: string,
  ): Promise<InvitationDispatchResultDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found.`,
      });
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Revoke outstanding unconsumed PASSWORD_RESET tokens
      await this.userInvitationsRepository.revokeOutstanding(
        userId,
        INVITATION_PURPOSES.PASSWORD_RESET,
        queryRunner,
      );

      // 2. Insert new reset token
      await this.userInvitationsRepository.create(
        userId,
        tokenHash,
        INVITATION_PURPOSES.PASSWORD_RESET,
        expiresAt,
        operatorUserId,
        queryRunner,
      );

      // 3. Flag MustChangePassword = 1
      await this.usersRepository.setMustChangePassword(userId, true, queryRunner);

      // 4. Record LogoutHistory for active sessions before revocation
      await this.usersRepository.recordLogoutHistoryForSessions(
        userId,
        'PASSWORD_RESET',
        queryRunner,
      );

      // 5. Revoke all active sessions immediately
      await this.usersRepository.revokeAllUserSessions(
        userId,
        'Password reset initiated by administrator',
        queryRunner,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // 6. Record Security Event
    await this.securityEventsService.log('PASSWORD_RESET_REQUESTED', {
      userId,
      description: `Password reset initiated for user [${user.username}] by operator [${operatorUserId || 'SYSTEM'}].`,
    });

    return {
      success: true,
      message: 'Password reset invitation sent successfully.',
      rawToken,
      expiresAt,
    };
  }

  /**
   * Clears failed login counters and lockout state for a locked user account (§5.4).
   */
  async unlockUser(
    userId: string,
    operatorUserId?: string,
  ): Promise<GenericSuccessResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found.`,
      });
    }

    await this.usersRepository.unlock(userId);

    await this.securityEventsService.log('USER_UNLOCKED', {
      userId,
      description: `User [${user.username}] account was unlocked by operator [${operatorUserId || 'SYSTEM'}].`,
    });

    return {
      success: true,
      message: `User [${user.username}] account unlocked successfully.`,
    };
  }
}
