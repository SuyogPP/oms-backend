import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RequestContextService } from '../../common/services/request-context.service';
import { SecurityEventsService } from '../security-events/services/security-events.service';
import { SecuritySettingsService } from '../security/services/security-settings.service';
import { AuthCoreController } from './controllers/auth-core.controller';
import { AuthCoreRepository } from './repositories/auth-core.repository';
import { AuthCoreService } from './services/auth-core.service';

describe('AuthCoreModule (Step 4)', () => {
  let service: AuthCoreService;
  let mockRepository: Partial<AuthCoreRepository>;
  let mockSecuritySettingsService: Partial<SecuritySettingsService>;
  let mockSecurityEventsService: Partial<SecurityEventsService>;
  let mockJwtService: Partial<JwtService>;
  let mockConfigService: Partial<ConfigService>;

  const mockPasswordHash = bcrypt.hashSync('Password123!', 10);

  beforeEach(async () => {
    mockRepository = {
      getUserByUsername: jest
        .fn()
        .mockImplementation(async (username: string) => {
          if (username === 'admin') {
            return {
              user_id: '1053433E-F36B-1410-85ED-009A959FB122',
              employee_id: 'EMP001',
              Username: 'admin',
              Email: 'admin@oms.local',
              UserType: 'INTERNAL',
              is_active: true,
              failed_login_count: 0,
              locked_until: null,
            };
          }
          if (username === 'locked_user') {
            return {
              user_id: '2053433E-F36B-1410-85ED-009A959FB122',
              employee_id: 'EMP002',
              Username: 'locked_user',
              Email: 'locked@oms.local',
              UserType: 'INTERNAL',
              is_active: true,
              failed_login_count: 5,
              locked_until: new Date(Date.now() + 3600000), // locked for 1 hour
            };
          }
          if (username === 'inactive_user') {
            return {
              user_id: '3053433E-F36B-1410-85ED-009A959FB122',
              employee_id: 'EMP003',
              Username: 'inactive_user',
              Email: 'inactive@oms.local',
              UserType: 'INTERNAL',
              is_active: false,
              failed_login_count: 0,
              locked_until: null,
            };
          }
          return null;
        }),
      getUserCredential: jest.fn().mockResolvedValue(mockPasswordHash),
      recordFailedLogin: jest.fn().mockResolvedValue(undefined),
      lockUser: jest.fn().mockResolvedValue(undefined),
      resetFailedLogin: jest.fn().mockResolvedValue(undefined),
      createFailedLoginAttempt: jest.fn().mockResolvedValue(undefined),
      createLoginHistory: jest.fn().mockResolvedValue(undefined),
      createLogoutHistory: jest.fn().mockResolvedValue(undefined),
      getActiveSessionCount: jest.fn().mockResolvedValue(0),
      getOldestActiveSession: jest.fn().mockResolvedValue('oldest-session-id'),
      createLoginSession: jest.fn().mockResolvedValue(undefined),
      updateRefreshToken: jest.fn().mockResolvedValue(undefined),
      rotateRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeSession: jest.fn().mockResolvedValue(undefined),
      revokeAllSessionsForUser: jest.fn().mockResolvedValue(undefined),
      getUserSessionData: jest.fn().mockResolvedValue({
        userId: '1053433E-F36B-1410-85ED-009A959FB122',
        username: 'admin',
        email: 'admin@oms.local',
        userType: 'INTERNAL',
        roles: ['SUPER_ADMIN', 'ADMIN'],
        permissions: ['SECURITY.ADMIN'],
        scopes: [],
      }),
      findSessionByRefreshTokenHash: jest
        .fn()
        .mockImplementation(async (hash: string) => {
          const validHash = crypto
            .createHash('sha256')
            .update('valid-token')
            .digest('hex');
          const replayedHash = crypto
            .createHash('sha256')
            .update('replayed-token')
            .digest('hex');

          if (hash === validHash) {
            return {
              login_session_id: 'sess-active',
              user_id: '1053433E-F36B-1410-85ED-009A959FB122',
              is_active: true,
              expires_at: new Date(Date.now() + 86400000),
              revoked_at: null,
              refresh_token_hash: validHash,
              refresh_token_expires_at: new Date(Date.now() + 86400000),
              refresh_token_revoked_at: null,
              ip_address: '127.0.0.1',
              user_agent: 'Jest',
              browser_name: 'Chrome',
              device_type: 'DESKTOP',
              last_activity_at: new Date(),
            };
          }
          if (hash === replayedHash) {
            return {
              login_session_id: 'sess-replayed',
              user_id: '1053433E-F36B-1410-85ED-009A959FB122',
              is_active: true,
              expires_at: new Date(Date.now() + 86400000),
              revoked_at: null,
              refresh_token_hash: replayedHash,
              refresh_token_expires_at: new Date(Date.now() + 86400000),
              refresh_token_revoked_at: new Date(Date.now() - 60000), // revoked 60 seconds ago (outside 30s grace)
              ip_address: '127.0.0.1',
              user_agent: 'Jest',
              browser_name: 'Chrome',
              device_type: 'DESKTOP',
              last_activity_at: new Date(),
            };
          }
          return null;
        }),
    };

    mockSecuritySettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        maxConcurrentSessions: 3,
        allowMultipleSessions: true,
        autoRevokeOldestSession: true,
        accessTokenLifetime: 15,
        refreshTokenLifetime: 30,
        requireSessionFingerprinting: false,
        maxFailedLoginAttempts: 5,
        lockoutDuration: 30,
        enableReplayDetection: true,
        replayActionRevoke: true,
        replayActionLog: true,
        replayActionLogout: true,
      }),
    };

    mockSecurityEventsService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'jwt.issuer') return 'OMS';
        if (key === 'jwt.audience') return 'OMS_USERS';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthCoreController],
      providers: [
        AuthCoreService,
        RequestContextService,
        { provide: AuthCoreRepository, useValue: mockRepository },
        {
          provide: SecuritySettingsService,
          useValue: mockSecuritySettingsService,
        },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthCoreService>(AuthCoreService);
  });

  describe('login', () => {
    it('should successfully authenticate valid credentials and issue tokens', async () => {
      const result = await service.login(
        { username: 'admin', password: 'Password123!' },
        '127.0.0.1',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.username).toBe('admin');
      expect(mockRepository.resetFailedLogin).toHaveBeenCalledWith(
        '1053433E-F36B-1410-85ED-009A959FB122',
      );
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'LOGIN_SUCCESS',
        expect.objectContaining({
          userId: '1053433E-F36B-1410-85ED-009A959FB122',
        }),
      );
    });

    it('should reject unknown username and log failed attempt', async () => {
      await expect(
        service.login(
          { username: 'nonexistent', password: 'Password123!' },
          '127.0.0.1',
          'Jest',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRepository.createFailedLoginAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'nonexistent',
          failureReason: 'INVALID_USERNAME',
        }),
      );
    });

    it('should reject locked account', async () => {
      await expect(
        service.login(
          { username: 'locked_user', password: 'Password123!' },
          '127.0.0.1',
          'Jest',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRepository.createFailedLoginAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'locked_user',
          failureReason: 'ACCOUNT_LOCKED',
        }),
      );
    });

    it('should reject invalid password and record failure', async () => {
      await expect(
        service.login(
          { username: 'admin', password: 'WrongPassword!' },
          '127.0.0.1',
          'Jest',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRepository.recordFailedLogin).toHaveBeenCalledWith(
        '1053433E-F36B-1410-85ED-009A959FB122',
      );
      expect(mockRepository.createFailedLoginAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'admin',
          failureReason: 'INVALID_PASSWORD',
        }),
      );
    });

    it('should handle concurrent session limit by requesting confirmation when autoRevoke is enabled', async () => {
      (mockRepository.getActiveSessionCount as jest.Mock).mockResolvedValue(3);

      await expect(
        service.login(
          {
            username: 'admin',
            password: 'Password123!',
            confirmRevokeOldest: false,
          },
          '127.0.0.1',
          'Jest',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should auto-revoke oldest session when confirmRevokeOldest is true', async () => {
      (mockRepository.getActiveSessionCount as jest.Mock).mockResolvedValue(3);

      const result = await service.login(
        {
          username: 'admin',
          password: 'Password123!',
          confirmRevokeOldest: true,
        },
        '127.0.0.1',
        'Jest',
      );

      expect(result.success).toBe(true);
      expect(mockRepository.revokeSession).toHaveBeenCalledWith(
        'oldest-session-id',
      );
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'SESSION_AUTO_REVOKED',
        expect.objectContaining({ loginSessionId: 'oldest-session-id' }),
      );
    });
  });

  describe('refresh', () => {
    it('should rotate refresh token and issue new access token', async () => {
      const result = await service.refresh(
        { refreshToken: 'valid-token' },
        '127.0.0.1',
        'Jest',
      );

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBeDefined();
      expect(mockRepository.revokeRefreshToken).toHaveBeenCalledWith(
        'sess-active',
      );
      expect(mockRepository.rotateRefreshToken).toHaveBeenCalled();
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'REFRESH_TOKEN_ROTATED',
        expect.objectContaining({ loginSessionId: 'sess-active' }),
      );
    });

    it('should detect replay attack on revoked refresh token and execute security actions', async () => {
      await expect(
        service.refresh(
          { refreshToken: 'replayed-token' },
          '127.0.0.1',
          'Jest',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockRepository.revokeSession).toHaveBeenCalledWith(
        'sess-replayed',
      );
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'REFRESH_TOKEN_REPLAY',
        expect.objectContaining({ loginSessionId: 'sess-replayed' }),
      );
      expect(mockRepository.revokeAllSessionsForUser).toHaveBeenCalledWith(
        '1053433E-F36B-1410-85ED-009A959FB122',
      );
    });
  });

  describe('logout', () => {
    it('should revoke session, record logout history, and log security event', async () => {
      const result = await service.logout(
        'sess-active',
        '1053433E-F36B-1410-85ED-009A959FB122',
        '127.0.0.1',
        'Jest',
      );

      expect(result.success).toBe(true);
      expect(mockRepository.revokeSession).toHaveBeenCalledWith('sess-active');
      expect(mockRepository.revokeRefreshToken).toHaveBeenCalledWith(
        'sess-active',
      );
      expect(mockRepository.createLogoutHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          loginSessionId: 'sess-active',
          logoutReason: 'USER_LOGOUT',
        }),
      );
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'LOGOUT',
        expect.objectContaining({ loginSessionId: 'sess-active' }),
      );
    });
  });
});
