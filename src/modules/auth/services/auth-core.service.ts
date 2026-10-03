import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { SECURITY_EVENTS } from '../../security-events/constants/security-events.constants';
import { SecurityEventsService } from '../../security-events/services/security-events.service';
import { SecuritySettingsService } from '../../security/services/security-settings.service';
import {
  LoginDto,
  LoginResponseDto,
  LogoutResponseDto,
  RefreshResponseDto,
  RefreshTokenDto,
} from '../dto/auth-core.dto';
import { AuthCoreRepository } from '../repositories/auth-core.repository';
import { detectBrowser, detectDeviceType } from '../utils/device-detector.util';

@Injectable()
export class AuthCoreService {
  private readonly logger = new Logger(AuthCoreService.name);

  constructor(
    private readonly repository: AuthCoreRepository,
    @Inject(forwardRef(() => SecuritySettingsService))
    private readonly securitySettingsService: SecuritySettingsService,
    private readonly securityEventsService: SecurityEventsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    dto: LoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResponseDto> {
    const deviceType = detectDeviceType(userAgent);
    const browserName = detectBrowser(userAgent);

    const user = await this.repository.getUserByUsername(dto.username);

    // 1. User not found
    if (!user) {
      await this.repository.createLoginHistory({
        username: dto.username,
        ipAddress,
        userAgent,
        deviceType,
        browserName,
        isSSOLogin: false,
        loginResult: 'FAILED',
        failureReason: 'INVALID_CREDENTIALS',
      });

      await this.repository.createFailedLoginAttempt({
        username: dto.username,
        ipAddress,
        userAgent,
        deviceType,
        browserName,
        isSSOLogin: false,
        failureReason: 'INVALID_USERNAME',
      });

      await this.securityEventsService.log(SECURITY_EVENTS.LOGIN_FAILURE, {
        description: 'INVALID_USERNAME',
        ipAddress,
        userAgent,
      });

      throw new UnauthorizedException('Invalid username or password');
    }

    // 2. Account Lockout Check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await this.repository.createFailedLoginAttempt({
        userId: user.user_id,
        username: user.Username,
        ipAddress,
        userAgent,
        deviceType,
        browserName,
        isSSOLogin: false,
        failureReason: 'ACCOUNT_LOCKED',
      });

      await this.repository.createLoginHistory({
        userId: user.user_id,
        username: user.Username,
        ipAddress,
        userAgent,
        deviceType,
        browserName,
        isSSOLogin: false,
        loginResult: 'FAILED',
        failureReason: 'ACCOUNT_LOCKED',
      });

      await this.securityEventsService.log(SECURITY_EVENTS.ACCOUNT_LOCKED, {
        userId: user.user_id,
        ipAddress,
        userAgent,
        description: 'Login attempt on locked account',
      });

      throw new UnauthorizedException('Invalid username or password');
    }

    // 3. Inactive Check
    if (!user.is_active) {
      await this.repository.createLoginHistory({
        userId: user.user_id,
        username: user.Username,
        ipAddress,
        userAgent,
        deviceType,
        browserName,
        isSSOLogin: false,
        loginResult: 'FAILED',
        failureReason: 'ACCOUNT_INACTIVE',
      });

      throw new UnauthorizedException('Invalid username or password');
    }

    // 4. Password Verification
    const passwordHash = await this.repository.getUserCredential(user.user_id);
    const isPasswordValid = passwordHash
      ? await bcrypt.compare(dto.password, passwordHash)
      : false;

    if (!isPasswordValid) {
      await this.repository.recordFailedLogin(user.user_id);

      const settings = await this.securitySettingsService.getSettings();
      if (user.failed_login_count + 1 >= settings.maxFailedLoginAttempts) {
        await this.repository.lockUser(user.user_id, settings.lockoutDuration);
        await this.securityEventsService.log(SECURITY_EVENTS.ACCOUNT_LOCKED, {
          userId: user.user_id,
          ipAddress,
          userAgent,
          description: `Account locked after ${user.failed_login_count + 1} failed attempts for ${settings.lockoutDuration} minutes`,
        });
      }

      await this.repository.createFailedLoginAttempt({
        userId: user.user_id,
        username: user.Username,
        ipAddress,
        userAgent,
        deviceType,
        browserName,
        isSSOLogin: false,
        failureReason: 'INVALID_PASSWORD',
      });

      await this.repository.createLoginHistory({
        userId: user.user_id,
        username: user.Username,
        ipAddress,
        userAgent,
        deviceType,
        browserName,
        isSSOLogin: false,
        loginResult: 'FAILED',
        failureReason: 'INVALID_PASSWORD',
      });

      await this.securityEventsService.log(SECURITY_EVENTS.LOGIN_FAILURE, {
        userId: user.user_id,
        ipAddress,
        userAgent,
        description: 'INVALID_PASSWORD',
      });

      throw new UnauthorizedException('Invalid username or password');
    }

    // 5. Reset failed attempts on success
    await this.repository.resetFailedLogin(user.user_id);

    // 6. Concurrent Session Limits
    const settings = await this.securitySettingsService.getSettings();
    const activeSessionCount = await this.repository.getActiveSessionCount(
      user.user_id,
    );

    if (!settings.allowMultipleSessions && activeSessionCount > 0) {
      if (settings.autoRevokeOldestSession) {
        if (dto.confirmRevokeOldest) {
          const oldestSid = await this.repository.getOldestActiveSession(
            user.user_id,
          );
          if (oldestSid) {
            await this.repository.revokeSession(oldestSid);
            await this.securityEventsService.log(
              SECURITY_EVENTS.SESSION_AUTO_REVOKED,
              {
                userId: user.user_id,
                loginSessionId: oldestSid,
                description:
                  'Auto-revoked oldest session due to single session policy',
              },
            );
          }
        } else {
          throw new ConflictException({
            code: 'CONFIRM_REVOKE_OLDEST',
            message: 'Confirmation required to revoke oldest session',
          });
        }
      } else {
        await this.securityEventsService.log(
          SECURITY_EVENTS.CONCURRENT_SESSION_LIMIT_EXCEEDED,
          {
            userId: user.user_id,
            ipAddress,
            userAgent,
            description:
              'Concurrent session limit exceeded (multiple sessions disabled)',
          },
        );
        throw new ForbiddenException({
          code: 'MAX_SESSIONS_REACHED',
          message:
            'Maximum number of sessions reached, please contact your admin.',
        });
      }
    } else if (
      settings.allowMultipleSessions &&
      activeSessionCount >= settings.maxConcurrentSessions
    ) {
      if (settings.autoRevokeOldestSession) {
        if (dto.confirmRevokeOldest) {
          const oldestSid = await this.repository.getOldestActiveSession(
            user.user_id,
          );
          if (oldestSid) {
            await this.repository.revokeSession(oldestSid);
            await this.securityEventsService.log(
              SECURITY_EVENTS.SESSION_AUTO_REVOKED,
              {
                userId: user.user_id,
                loginSessionId: oldestSid,
                description: `Auto-revoked oldest session due to concurrent session limit (${settings.maxConcurrentSessions} max)`,
              },
            );
          }
        } else {
          throw new ConflictException({
            code: 'CONFIRM_REVOKE_OLDEST',
            message: 'Confirmation required to revoke oldest session',
          });
        }
      } else {
        await this.securityEventsService.log(
          SECURITY_EVENTS.CONCURRENT_SESSION_LIMIT_EXCEEDED,
          {
            userId: user.user_id,
            ipAddress,
            userAgent,
            description: `Concurrent session limit exceeded (${settings.maxConcurrentSessions} max)`,
          },
        );
        throw new ForbiddenException({
          code: 'MAX_SESSIONS_REACHED',
          message:
            'Maximum number of sessions reached, please contact your admin.',
        });
      }
    }

    // 7. Create Session
    const loginSessionId = crypto.randomUUID();
    await this.repository.createLoginSession({
      loginSessionId,
      userId: user.user_id,
      ipAddress,
      userAgent,
      browserName,
      deviceType,
      deviceFingerprint: dto.deviceFingerprint,
      sessionExpiryDays: settings.refreshTokenLifetime,
    });

    await this.securityEventsService.log(SECURITY_EVENTS.SESSION_CREATED, {
      userId: user.user_id,
      loginSessionId,
      ipAddress,
      userAgent,
      description: 'User Session Created',
    });

    // 8. Generate Tokens
    const userDetails = await this.repository.getUserSessionData(user.user_id);
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await this.repository.updateRefreshToken(
      loginSessionId,
      refreshTokenHash,
      settings.refreshTokenLifetime,
    );

    const accessToken = this.jwtService.sign(
      {
        userId: user.user_id,
        username:
          userDetails?.username || user.Username || user.Email?.split('@')[0],
        loginSessionId,
        userType: userDetails?.userType || user.UserType,
        email: userDetails?.email || user.Email,
        roles: userDetails?.roles || [],
        permissions: userDetails?.permissions || [],
        scopes: userDetails?.scopes || [],
      },
      {
        expiresIn: `${settings.accessTokenLifetime}m`,
        issuer: this.configService.get<string>('jwt.issuer') || 'OMS',
        audience: this.configService.get<string>('jwt.audience') || 'OMS_USERS',
      },
    );

    // 9. Record Login History
    await this.repository.createLoginHistory({
      userId: user.user_id,
      username: user.Username,
      ipAddress,
      userAgent,
      loginSessionId,
      deviceType,
      browserName,
      isSSOLogin: false,
      loginResult: 'SUCCESS',
    });

    await this.securityEventsService.log(SECURITY_EVENTS.LOGIN_SUCCESS, {
      userId: user.user_id,
      loginSessionId,
      ipAddress,
      userAgent,
      description: `Successfully logged in from ${userAgent} with IP ${ipAddress}`,
    });

    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        userId: user.user_id,
        username: user.Username,
        email: user.Email,
        userType: userDetails?.userType || user.UserType,
        employeeId: user.employee_id || null,
        roles: userDetails?.roles || [],
        permissions: userDetails?.permissions || [],
        scopes: userDetails?.scopes || [],
        loginSessionId,
      },
    };
  }

  async refresh(
    dto: RefreshTokenDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<RefreshResponseDto> {
    const refreshHash = crypto
      .createHash('sha256')
      .update(dto.refreshToken)
      .digest('hex');
    const session =
      await this.repository.findSessionByRefreshTokenHash(refreshHash);

    if (!session) {
      this.logger.warn('[SECURITY] Refresh attempt with unknown token hash');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const settings = await this.securitySettingsService.getSettings();

    // 1. REPLAY DETECTION
    if (
      settings.enableReplayDetection &&
      session.refresh_token_revoked_at !== null
    ) {
      const revokedAt = new Date(session.refresh_token_revoked_at);
      const diffInSeconds = (Date.now() - revokedAt.getTime()) / 1000;

      if (diffInSeconds < 30) {
        this.logger.warn(
          `[SECURITY] Concurrent refresh detected within grace period (${diffInSeconds.toFixed(1)}s).`,
        );
        // Return safe message without throwing an error that logs out the user
        throw new ConflictException({
          code: 'CONCURRENT_REFRESH',
          message: 'Concurrent refresh handled',
        });
      }

      this.logger.error(
        `[SECURITY] REFRESH TOKEN REPLAY DETECTED — Session: ${session.login_session_id}, User: ${session.user_id}.`,
      );

      if (settings.replayActionRevoke) {
        await this.repository.revokeSession(session.login_session_id);
      }

      if (settings.replayActionLog) {
        await this.securityEventsService.log(
          SECURITY_EVENTS.REFRESH_TOKEN_REPLAY,
          {
            userId: session.user_id,
            loginSessionId: session.login_session_id,
            description: 'Refresh token replay attack detected',
            ipAddress,
            userAgent,
          },
        );
      }

      if (settings.replayActionLogout) {
        await this.repository.revokeAllSessionsForUser(session.user_id);
      }

      throw new ForbiddenException({
        code: 'REFRESH_TOKEN_REPLAY',
        message: 'Security violation detected',
      });
    }

    // 2. Validate Session Status
    if (!session.is_active) {
      this.logger.warn(
        `[SECURITY] Refresh attempt on inactive session: ${session.login_session_id}`,
      );
      throw new UnauthorizedException('Session is no longer active');
    }

    if (session.revoked_at !== null) {
      this.logger.warn(
        `[SECURITY] Refresh attempt on revoked session: ${session.login_session_id}`,
      );
      throw new UnauthorizedException('Session has been revoked');
    }

    if (new Date(session.expires_at) <= new Date()) {
      this.logger.warn(
        `[SECURITY] Refresh attempt on expired session: ${session.login_session_id}`,
      );
      await this.securityEventsService.log(SECURITY_EVENTS.SESSION_EXPIRED, {
        userId: session.user_id,
        loginSessionId: session.login_session_id,
        description: 'Attempted to refresh an expired session',
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Session has expired');
    }

    if (
      session.refresh_token_expires_at &&
      new Date(session.refresh_token_expires_at) <= new Date()
    ) {
      this.logger.warn(
        `[SECURITY] Refresh attempt with expired refresh token: ${session.login_session_id}`,
      );
      await this.securityEventsService.log(SECURITY_EVENTS.TOKEN_EXPIRED, {
        userId: session.user_id,
        loginSessionId: session.login_session_id,
        description: 'Attempted to use an expired refresh token',
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    // 3. Rotate Refresh Token
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const newRefreshHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');

    await this.repository.revokeRefreshToken(session.login_session_id);
    await this.repository.rotateRefreshToken(
      session.login_session_id,
      newRefreshHash,
      settings.refreshTokenLifetime,
    );

    await this.securityEventsService.log(
      SECURITY_EVENTS.REFRESH_TOKEN_ROTATED,
      {
        userId: session.user_id,
        loginSessionId: session.login_session_id,
        description: 'Refresh Token Rotated',
        ipAddress,
        userAgent,
      },
    );

    // 4. Issue New JWT
    const userDetails = await this.repository.getUserSessionData(
      session.user_id,
    );
    const accessToken = this.jwtService.sign(
      {
        userId: session.user_id,
        username:
          userDetails?.username || userDetails?.email?.split('@')[0] || 'User',
        loginSessionId: session.login_session_id,
        userType: userDetails?.userType || 'User',
        email: userDetails?.email || '',
        roles: userDetails?.roles || [],
        permissions: userDetails?.permissions || [],
        scopes: userDetails?.scopes || [],
      },
      {
        expiresIn: `${settings.accessTokenLifetime}m`,
        issuer: this.configService.get<string>('jwt.issuer') || 'OMS',
        audience: this.configService.get<string>('jwt.audience') || 'OMS_USERS',
      },
    );

    return {
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(
    loginSessionId: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<LogoutResponseDto> {
    await this.repository.revokeSession(loginSessionId);
    await this.repository.revokeRefreshToken(loginSessionId);

    const userDetails = await this.repository.getUserSessionData(userId);

    await this.repository.createLogoutHistory({
      loginSessionId,
      userId,
      username: userDetails?.username || 'Unknown',
      ipAddress,
      userAgent,
      logoutReason: 'USER_LOGOUT',
    });

    await this.securityEventsService.log(SECURITY_EVENTS.LOGOUT, {
      userId,
      loginSessionId,
      ipAddress,
      userAgent,
      description: 'User explicitly logged out',
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }
}
