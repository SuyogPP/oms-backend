import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SECURITY_EVENTS } from '../../security-events/constants/security-events.constants';
import { SecurityEventsService } from '../../security-events/services/security-events.service';
import {
  SessionActionResponseDto,
  UserActiveSessionDto,
  UserSessionsListResponseDto,
} from '../dto/user-sessions.dto';
import { UserSessionsRepository } from '../repositories/user-sessions.repository';

@Injectable()
export class UserSessionsService {
  private readonly logger = new Logger(UserSessionsService.name);

  constructor(
    private readonly repository: UserSessionsRepository,
    private readonly securityEventsService: SecurityEventsService,
  ) {}

  async getUserSessions(
    userId: string,
    currentSessionId?: string | null,
  ): Promise<UserSessionsListResponseDto> {
    const rows = await this.repository.getActiveSessionsByUserId(userId);

    const currentSidUpper = currentSessionId
      ? currentSessionId.toUpperCase()
      : null;

    const sessions: UserActiveSessionDto[] = rows.map((row) => {
      const sidUpper = row.login_session_id.toUpperCase();
      const isCurrent = Boolean(
        currentSidUpper && sidUpper === currentSidUpper,
      );

      return {
        loginSessionId: row.login_session_id,
        LoginSessionID: row.login_session_id,
        ipAddress: row.IPAddress,
        browserName: row.browser_name || null,
        deviceType: row.device_type || null,
        createdAt: new Date(row.login_at).toISOString(),
        lastActivityAt: row.last_activity_at
          ? new Date(row.last_activity_at).toISOString()
          : null,
        expiresAt: new Date(row.expires_at).toISOString(),
        isCurrentSession: isCurrent,
      };
    });

    return {
      success: true,
      sessions,
    };
  }

  async revokeSession(
    sessionId: string,
    userId: string,
    currentSessionId?: string | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SessionActionResponseDto> {
    if (!userId) {
      throw new ForbiddenException('Unauthorized');
    }

    // Prevent self termination
    if (
      currentSessionId &&
      sessionId.toUpperCase() === currentSessionId.toUpperCase()
    ) {
      throw new BadRequestException('Cannot terminate current session');
    }

    // Verify session existence
    const session = await this.repository.getSessionById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Verify ownership
    if (session.user_id.toUpperCase() !== userId.toUpperCase()) {
      throw new ForbiddenException('Forbidden');
    }

    // Revoke session in database
    await this.repository.revokeSession(sessionId);

    // Record logout history
    await this.repository.createLogoutHistory({
      userId,
      loginSessionId: sessionId,
      username: session.Username || 'Unknown',
      ipAddress,
      userAgent,
      logoutReason: 'SESSION_TERMINATED',
    });

    // Log security event
    await this.securityEventsService.log(SECURITY_EVENTS.SESSION_REVOKED, {
      userId,
      loginSessionId: sessionId,
      ipAddress,
      userAgent,
      description: 'User Session Revoked',
    });

    return {
      success: true,
      message: 'Session terminated',
    };
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId?: string | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SessionActionResponseDto> {
    if (!userId || !currentSessionId) {
      throw new ForbiddenException('Unauthorized');
    }

    const revokedSessions = await this.repository.revokeAllOtherSessions(
      userId,
      currentSessionId,
    );

    // Record logout history for each revoked session
    for (const session of revokedSessions) {
      await this.repository.createLogoutHistory({
        userId,
        loginSessionId: session.login_session_id,
        username: session.Username || 'Unknown',
        ipAddress,
        userAgent,
        logoutReason: 'ALL_OTHER_SESSIONS_TERMINATED',
      });
    }

    // Log security event
    await this.securityEventsService.log(SECURITY_EVENTS.SESSION_REVOKED, {
      userId,
      loginSessionId: currentSessionId,
      ipAddress,
      userAgent,
      description: 'All other sessions terminated by user',
    });

    return {
      success: true,
      message: 'All other sessions terminated',
    };
  }
}
