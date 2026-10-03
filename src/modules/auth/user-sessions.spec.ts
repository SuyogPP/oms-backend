import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RequestContextService } from '../../common/services/request-context.service';
import { SecurityEventsService } from '../security-events/services/security-events.service';
import { UserSessionsController } from './controllers/user-sessions.controller';
import { UserSessionsRepository } from './repositories/user-sessions.repository';
import { UserSessionsService } from './services/user-sessions.service';

describe('UserSessionsModule (Step 3)', () => {
  let service: UserSessionsService;
  let mockRepository: Partial<UserSessionsRepository>;
  let mockSecurityEventsService: Partial<SecurityEventsService>;

  beforeEach(async () => {
    mockRepository = {
      getActiveSessionsByUserId: jest.fn().mockResolvedValue([
        {
          login_session_id: 'sess-current',
          ip_address: '127.0.0.1',
          browser_name: 'Chrome',
          device_type: 'Desktop',
          login_at: new Date('2026-08-20T10:00:00Z'),
          last_activity_at: new Date('2026-08-20T10:30:00Z'),
          expires_at: new Date('2026-09-20T10:00:00Z'),
          is_active: true,
        },
        {
          login_session_id: 'sess-other',
          ip_address: '192.168.1.50',
          browser_name: 'Safari',
          device_type: 'Mobile',
          login_at: new Date('2026-08-19T08:00:00Z'),
          last_activity_at: new Date('2026-08-19T09:00:00Z'),
          expires_at: new Date('2026-09-19T08:00:00Z'),
          is_active: true,
        },
      ]),
      getSessionById: jest
        .fn()
        .mockImplementation(async (sessionId: string) => {
          if (sessionId === 'sess-other') {
            return {
              login_session_id: 'sess-other',
              user_id: 'usr-1',
              Username: 'admin',
              ip_address: '192.168.1.50',
              user_agent: 'Safari',
              is_active: true,
              revoked_at: null,
              expires_at: new Date('2026-09-19T08:00:00Z'),
            };
          }
          if (sessionId === 'sess-someone-else') {
            return {
              login_session_id: 'sess-someone-else',
              user_id: 'usr-2',
              Username: 'otheruser',
              ip_address: '10.0.0.1',
              user_agent: 'Firefox',
              is_active: true,
              revoked_at: null,
              expires_at: new Date('2026-09-19T08:00:00Z'),
            };
          }
          return null;
        }),
      revokeSession: jest.fn().mockResolvedValue(1),
      revokeAllOtherSessions: jest.fn().mockResolvedValue([
        {
          login_session_id: 'sess-other',
          user_id: 'usr-1',
          Username: 'admin',
        },
      ]),
      createLogoutHistory: jest.fn().mockResolvedValue(undefined),
    };

    mockSecurityEventsService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserSessionsController],
      providers: [
        UserSessionsService,
        RequestContextService,
        {
          provide: UserSessionsRepository,
          useValue: mockRepository,
        },
        {
          provide: SecurityEventsService,
          useValue: mockSecurityEventsService,
        },
      ],
    }).compile();

    service = module.get<UserSessionsService>(UserSessionsService);
  });

  describe('getUserSessions', () => {
    it('should return list of sessions and correctly flag isCurrentSession', async () => {
      const result = await service.getUserSessions('usr-1', 'sess-current');
      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);

      const current = result.sessions.find(
        (s) => s.loginSessionId === 'sess-current',
      );
      const other = result.sessions.find(
        (s) => s.loginSessionId === 'sess-other',
      );

      expect(current?.isCurrentSession).toBe(true);
      expect(other?.isCurrentSession).toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('should prevent self termination', async () => {
      await expect(
        service.revokeSession(
          'sess-current',
          'usr-1',
          'sess-current',
          '127.0.0.1',
          'Jest',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if session does not exist', async () => {
      await expect(
        service.revokeSession(
          'nonexistent-sess',
          'usr-1',
          'sess-current',
          '127.0.0.1',
          'Jest',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if session belongs to another user', async () => {
      await expect(
        service.revokeSession(
          'sess-someone-else',
          'usr-1',
          'sess-current',
          '127.0.0.1',
          'Jest',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully revoke another session of the user, write logout history, and log security event', async () => {
      const result = await service.revokeSession(
        'sess-other',
        'usr-1',
        'sess-current',
        '127.0.0.1',
        'Jest',
      );
      expect(result.success).toBe(true);
      expect(mockRepository.revokeSession).toHaveBeenCalledWith('sess-other');
      expect(mockRepository.createLogoutHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          loginSessionId: 'sess-other',
          userId: 'usr-1',
          logoutReason: 'SESSION_TERMINATED',
        }),
      );
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'SESSION_REVOKED',
        expect.objectContaining({
          loginSessionId: 'sess-other',
          userId: 'usr-1',
        }),
      );
    });
  });

  describe('revokeAllOtherSessions', () => {
    it('should revoke all sessions except the current one and record logout history', async () => {
      const result = await service.revokeAllOtherSessions(
        'usr-1',
        'sess-current',
        '127.0.0.1',
        'Jest',
      );
      expect(result.success).toBe(true);
      expect(mockRepository.revokeAllOtherSessions).toHaveBeenCalledWith(
        'usr-1',
        'sess-current',
      );
      expect(mockRepository.createLogoutHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          loginSessionId: 'sess-other',
          userId: 'usr-1',
          logoutReason: 'ALL_OTHER_SESSIONS_TERMINATED',
        }),
      );
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'SESSION_REVOKED',
        expect.objectContaining({
          userId: 'usr-1',
        }),
      );
    });
  });
});
