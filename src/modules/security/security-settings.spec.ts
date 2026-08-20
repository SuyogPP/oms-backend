import { Test, TestingModule } from '@nestjs/testing';
import { SecuritySettingsService } from './services/security-settings.service';
import { SecuritySettingsRepository } from './repositories/security-settings.repository';
import { SecurityEventsService } from '../security-events/services/security-events.service';
import { SecuritySettingsController } from './controllers/security-settings.controller';
import { RequestContextService } from '../../common/services/request-context.service';
import { AuthorizationService } from '../auth/services/authorization.service';
import { Reflector } from '@nestjs/core';

describe('SecuritySettingsModule (Step 2)', () => {
    let service: SecuritySettingsService;
    let mockRepository: Partial<SecuritySettingsRepository>;
    let mockSecurityEventsService: Partial<SecurityEventsService>;

    beforeEach(async () => {
        mockRepository = {
            getAllSettings: jest.fn().mockResolvedValue([
                { SettingCode: 'MAX_CONCURRENT_SESSIONS', SettingValue: '3' },
                { SettingCode: 'ALLOW_MULTIPLE_SESSIONS', SettingValue: 'false' },
                { SettingCode: 'AUTO_REVOKE_OLDEST_SESSION', SettingValue: 'false' },
                { SettingCode: 'ACCESS_TOKEN_LIFETIME', SettingValue: '15' },
                { SettingCode: 'REFRESH_TOKEN_LIFETIME', SettingValue: '30' },
                { SettingCode: 'REQUIRE_SESSION_FINGERPRINTING', SettingValue: 'false' },
                { SettingCode: 'MAX_FAILED_LOGIN_ATTEMPTS', SettingValue: '5' },
                { SettingCode: 'LOCKOUT_DURATION', SettingValue: '30' },
                { SettingCode: 'ENABLE_REPLAY_DETECTION', SettingValue: 'true' },
                { SettingCode: 'REPLAY_ACTION_REVOKE', SettingValue: 'true' },
                { SettingCode: 'REPLAY_ACTION_LOG', SettingValue: 'true' },
                { SettingCode: 'REPLAY_ACTION_LOGOUT', SettingValue: 'true' },
                { SettingCode: 'SECURITY_EVENTS_RETENTION', SettingValue: '365' },
                { SettingCode: 'LOGIN_HISTORY_RETENTION', SettingValue: '365' },
                { SettingCode: 'LOGOUT_HISTORY_RETENTION', SettingValue: '365' },
                { SettingCode: 'FAILED_LOGIN_RETENTION', SettingValue: '180' },
            ]),
            updateSetting: jest.fn().mockResolvedValue(undefined),
            getSessionsByUserId: jest.fn().mockResolvedValue([
                {
                    loginSessionId: 'sess-1',
                    LoginSessionID: 'sess-1',
                    userId: 'usr-1',
                    UserID: 'usr-1',
                    ipAddress: '127.0.0.1',
                    IPAddress: '127.0.0.1',
                    userAgent: 'Chrome',
                    UserAgent: 'Chrome',
                    loginAt: '2026-08-20T10:00:00.000Z',
                    LoginAt: '2026-08-20T10:00:00.000Z',
                    expiresAt: '2026-09-20T10:00:00.000Z',
                    ExpiresAt: '2026-09-20T10:00:00.000Z',
                    isActive: true,
                    IsActive: true,
                    revokedAt: null,
                    RevokedAt: null,
                },
            ]),
            revokeSession: jest.fn().mockResolvedValue(1),
            revokeAllSessionsForUser: jest.fn().mockResolvedValue(2),
            revokeAllSessionsSystemWide: jest.fn().mockResolvedValue(10),
        };

        mockSecurityEventsService = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [SecuritySettingsController],
            providers: [
                SecuritySettingsService,
                RequestContextService,
                AuthorizationService,
                Reflector,
                {
                    provide: SecuritySettingsRepository,
                    useValue: mockRepository,
                },
                {
                    provide: SecurityEventsService,
                    useValue: mockSecurityEventsService,
                },
            ],
        }).compile();

        service = module.get<SecuritySettingsService>(SecuritySettingsService);
    });

    describe('getSettings', () => {
        it('should return typed security settings object with defaults', async () => {
            const settings = await service.getSettings();
            expect(settings.maxConcurrentSessions).toBe(3);
            expect(settings.allowMultipleSessions).toBe(false);
            expect(settings.accessTokenLifetime).toBe(15);
            expect(settings.refreshTokenLifetime).toBe(30);
            expect(settings.enableReplayDetection).toBe(true);
            expect(settings.failedLoginRetention).toBe(180);
        });
    });

    describe('updateSettings', () => {
        it('should update only modified settings and emit security events', async () => {
            const result = await service.updateSettings(
                {
                    maxConcurrentSessions: 5, // changed from 3
                    accessTokenLifetime: 15,  // unchanged
                },
                'admin-usr',
                '192.168.1.1',
                'Jest',
            );

            expect(result.success).toBe(true);
            expect(mockRepository.updateSetting).toHaveBeenCalledTimes(1);
            expect(mockRepository.updateSetting).toHaveBeenCalledWith(
                'MAX_CONCURRENT_SESSIONS',
                '5',
                'admin-usr',
            );
            expect(mockSecurityEventsService.log).toHaveBeenCalledTimes(1);
            expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
                'SECURITY_SETTING_CHANGED',
                expect.objectContaining({
                    userId: 'admin-usr',
                    description: 'Security setting MAX_CONCURRENT_SESSIONS changed from 3 to 5',
                }),
            );
        });
    });

    describe('Session Revocation Actions', () => {
        it('should list sessions by userId', async () => {
            const sessions = await service.getSessionsByUserId('usr-1');
            expect(sessions).toHaveLength(1);
            expect(sessions[0].loginSessionId).toBe('sess-1');
        });

        it('should revoke a single session and log admin security event', async () => {
            const result = await service.revokeSession('sess-1', 'admin-usr', '127.0.0.1', 'Jest');
            expect(result.success).toBe(true);
            expect(mockRepository.revokeSession).toHaveBeenCalledWith('sess-1');
            expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
                'ADMIN_REVOKE_SESSION',
                expect.objectContaining({
                    loginSessionId: 'sess-1',
                }),
            );
        });

        it('should force logout all sessions for a user and log admin security event', async () => {
            const result = await service.revokeAllSessionsForUser('usr-1', 'admin-usr', '127.0.0.1', 'Jest');
            expect(result.success).toBe(true);
            expect(mockRepository.revokeAllSessionsForUser).toHaveBeenCalledWith('usr-1');
            expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
                'ADMIN_FORCE_LOGOUT',
                expect.objectContaining({
                    userId: 'usr-1',
                }),
            );
        });

        it('should revoke all sessions system-wide and log admin security event', async () => {
            const result = await service.revokeAllSessionsSystemWide('admin-usr', '127.0.0.1', 'Jest');
            expect(result.success).toBe(true);
            expect(mockRepository.revokeAllSessionsSystemWide).toHaveBeenCalled();
            expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
                'ADMIN_REVOKE_SESSION',
                expect.any(Object),
            );
        });
    });
});
