import { Injectable, Logger } from '@nestjs/common';
import { SECURITY_EVENTS } from '../../security-events/constants/security-events.constants';
import { SecurityEventsService } from '../../security-events/services/security-events.service';
import {
    RevokeSessionsResponseDto,
    SecuritySettingsResponseDto,
    UpdateSecuritySettingsDto,
    UserSessionDto,
} from '../dto/security-settings.dto';
import { SecuritySettingsRepository } from '../repositories/security-settings.repository';

@Injectable()
export class SecuritySettingsService {
    private readonly logger = new Logger(SecuritySettingsService.name);

    constructor(
        private readonly repository: SecuritySettingsRepository,
        private readonly securityEventsService: SecurityEventsService,
    ) {}

    async getSettings(): Promise<SecuritySettingsResponseDto> {
        const rows = await this.repository.getAllSettings();
        const map: Record<string, string> = {};
        for (const row of rows) {
            map[row.SettingCode] = row.SettingValue;
        }

        return {
            maxConcurrentSessions: Number(map.MAX_CONCURRENT_SESSIONS || 3),
            allowMultipleSessions: map.ALLOW_MULTIPLE_SESSIONS === 'true',
            autoRevokeOldestSession: map.AUTO_REVOKE_OLDEST_SESSION === 'true',
            accessTokenLifetime: Number(map.ACCESS_TOKEN_LIFETIME || 15),
            refreshTokenLifetime: Number(map.REFRESH_TOKEN_LIFETIME || 30),
            requireSessionFingerprinting: map.REQUIRE_SESSION_FINGERPRINTING === 'true',
            maxFailedLoginAttempts: Number(map.MAX_FAILED_LOGIN_ATTEMPTS || 5),
            lockoutDuration: Number(map.LOCKOUT_DURATION || 30),
            enableReplayDetection: map.ENABLE_REPLAY_DETECTION !== 'false',
            replayActionRevoke: map.REPLAY_ACTION_REVOKE !== 'false',
            replayActionLog: map.REPLAY_ACTION_LOG !== 'false',
            replayActionLogout: map.REPLAY_ACTION_LOGOUT !== 'false',
            securityEventsRetention: Number(map.SECURITY_EVENTS_RETENTION || 365),
            loginHistoryRetention: Number(map.LOGIN_HISTORY_RETENTION || 365),
            logoutHistoryRetention: Number(map.LOGOUT_HISTORY_RETENTION || 365),
            failedLoginRetention: Number(map.FAILED_LOGIN_RETENTION || 180),
        };
    }

    async updateSettings(
        data: UpdateSecuritySettingsDto,
        updatedBy: string,
        ipAddress?: string,
        userAgent?: string,
    ): Promise<RevokeSessionsResponseDto> {
        const oldSettings = await this.getSettings();

        const settingConfigs: { code: string; key: keyof UpdateSecuritySettingsDto }[] = [
            { code: 'MAX_CONCURRENT_SESSIONS', key: 'maxConcurrentSessions' },
            { code: 'ALLOW_MULTIPLE_SESSIONS', key: 'allowMultipleSessions' },
            { code: 'AUTO_REVOKE_OLDEST_SESSION', key: 'autoRevokeOldestSession' },
            { code: 'ACCESS_TOKEN_LIFETIME', key: 'accessTokenLifetime' },
            { code: 'REFRESH_TOKEN_LIFETIME', key: 'refreshTokenLifetime' },
            { code: 'REQUIRE_SESSION_FINGERPRINTING', key: 'requireSessionFingerprinting' },
            { code: 'MAX_FAILED_LOGIN_ATTEMPTS', key: 'maxFailedLoginAttempts' },
            { code: 'LOCKOUT_DURATION', key: 'lockoutDuration' },
            { code: 'ENABLE_REPLAY_DETECTION', key: 'enableReplayDetection' },
            { code: 'REPLAY_ACTION_REVOKE', key: 'replayActionRevoke' },
            { code: 'REPLAY_ACTION_LOG', key: 'replayActionLog' },
            { code: 'REPLAY_ACTION_LOGOUT', key: 'replayActionLogout' },
            { code: 'SECURITY_EVENTS_RETENTION', key: 'securityEventsRetention' },
            { code: 'LOGIN_HISTORY_RETENTION', key: 'loginHistoryRetention' },
            { code: 'LOGOUT_HISTORY_RETENTION', key: 'logoutHistoryRetention' },
            { code: 'FAILED_LOGIN_RETENTION', key: 'failedLoginRetention' },
        ];

        let changedCount = 0;

        for (const { code, key } of settingConfigs) {
            if (data[key] !== undefined) {
                const newValStr = String(data[key]);
                const oldValStr = String(oldSettings[key]);

                if (newValStr !== oldValStr) {
                    await this.repository.updateSetting(code, newValStr, updatedBy);
                    changedCount++;

                    await this.securityEventsService.log(SECURITY_EVENTS.SECURITY_SETTING_CHANGED, {
                        userId: updatedBy,
                        ipAddress,
                        userAgent,
                        description: `Security setting ${code} changed from ${oldValStr} to ${newValStr}`,
                    });
                }
            }
        }

        return {
            success: true,
            message: `Successfully updated ${changedCount} security setting(s)`,
        };
    }

    async getSessionsByUserId(userId: string): Promise<UserSessionDto[]> {
        return this.repository.getSessionsByUserId(userId);
    }

    async revokeSession(
        sessionId: string,
        adminUserId?: string,
        ipAddress?: string,
        userAgent?: string,
    ): Promise<RevokeSessionsResponseDto> {
        const count = await this.repository.revokeSession(sessionId);

        await this.securityEventsService.log(SECURITY_EVENTS.ADMIN_REVOKE_SESSION, {
            userId: adminUserId,
            loginSessionId: sessionId,
            ipAddress,
            userAgent,
            description: 'User session revoked by Administrator',
        });

        return {
            success: true,
            message: 'Session revoked successfully',
            revokedSessions: count,
        };
    }

    async revokeAllSessionsForUser(
        userId: string,
        adminUserId?: string,
        ipAddress?: string,
        userAgent?: string,
    ): Promise<RevokeSessionsResponseDto> {
        const count = await this.repository.revokeAllSessionsForUser(userId);

        await this.securityEventsService.log(SECURITY_EVENTS.ADMIN_FORCE_LOGOUT, {
            userId,
            ipAddress,
            userAgent,
            description: `Admin ${adminUserId || 'SYSTEM'} forced logout for all active sessions of user ${userId}`,
        });

        return {
            success: true,
            message: `Successfully revoked all active sessions for user ${userId}`,
            revokedSessions: count,
        };
    }

    async revokeAllSessionsSystemWide(
        adminUserId?: string,
        ipAddress?: string,
        userAgent?: string,
    ): Promise<RevokeSessionsResponseDto> {
        const count = await this.repository.revokeAllSessionsSystemWide();

        await this.securityEventsService.log(SECURITY_EVENTS.ADMIN_REVOKE_SESSION, {
            userId: adminUserId,
            ipAddress,
            userAgent,
            description: `Admin ${adminUserId || 'SYSTEM'} forced logout for all active users system-wide`,
        });

        return {
            success: true,
            message: 'Successfully revoked all sessions system-wide.',
            revokedSessions: count,
        };
    }
}
