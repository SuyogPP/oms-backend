import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SecuritySettingsResponseDto {
    @ApiProperty({ description: 'Maximum concurrent sessions per user', default: 3, minimum: 1, maximum: 20 })
    maxConcurrentSessions: number;

    @ApiProperty({ description: 'Allow users to login from multiple devices', default: false })
    allowMultipleSessions: boolean;

    @ApiProperty({ description: 'Automatically revoke oldest session when limit is reached', default: false })
    autoRevokeOldestSession: boolean;

    @ApiProperty({ description: 'Access token lifetime in minutes', default: 15, minimum: 5, maximum: 60 })
    accessTokenLifetime: number;

    @ApiProperty({ description: 'Refresh token lifetime in days', default: 30, minimum: 1, maximum: 90 })
    refreshTokenLifetime: number;

    @ApiProperty({ description: 'Require device fingerprinting for sessions', default: false })
    requireSessionFingerprinting: boolean;

    @ApiProperty({ description: 'Maximum failed login attempts before account lockout', default: 5, minimum: 1, maximum: 20 })
    maxFailedLoginAttempts: number;

    @ApiProperty({ description: 'Lockout duration in minutes', default: 30, minimum: 1, maximum: 1440 })
    lockoutDuration: number;

    @ApiProperty({ description: 'Enable refresh token replay attack detection', default: true })
    enableReplayDetection: boolean;

    @ApiProperty({ description: 'Revoke compromised session upon replay detection', default: true })
    replayActionRevoke: boolean;

    @ApiProperty({ description: 'Log security event upon replay detection', default: true })
    replayActionLog: boolean;

    @ApiProperty({ description: 'Force logout user upon replay detection', default: true })
    replayActionLogout: boolean;

    @ApiProperty({ description: 'Security events retention period in days', default: 365, minimum: 1, maximum: 3650 })
    securityEventsRetention: number;

    @ApiProperty({ description: 'Login history retention period in days', default: 365, minimum: 1, maximum: 3650 })
    loginHistoryRetention: number;

    @ApiProperty({ description: 'Logout history retention period in days', default: 365, minimum: 1, maximum: 3650 })
    logoutHistoryRetention: number;

    @ApiProperty({ description: 'Failed login attempts retention period in days', default: 180, minimum: 1, maximum: 3650 })
    failedLoginRetention: number;
}

export class UpdateSecuritySettingsDto {
    @ApiPropertyOptional({ description: 'Maximum concurrent sessions per user', minimum: 1, maximum: 20 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(20)
    maxConcurrentSessions?: number;

    @ApiPropertyOptional({ description: 'Allow users to login from multiple devices' })
    @IsOptional()
    @IsBoolean()
    allowMultipleSessions?: boolean;

    @ApiPropertyOptional({ description: 'Automatically revoke oldest session when limit is reached' })
    @IsOptional()
    @IsBoolean()
    autoRevokeOldestSession?: boolean;

    @ApiPropertyOptional({ description: 'Access token lifetime in minutes', minimum: 5, maximum: 60 })
    @IsOptional()
    @IsInt()
    @Min(5)
    @Max(60)
    accessTokenLifetime?: number;

    @ApiPropertyOptional({ description: 'Refresh token lifetime in days', minimum: 1, maximum: 90 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(90)
    refreshTokenLifetime?: number;

    @ApiPropertyOptional({ description: 'Require device fingerprinting for sessions' })
    @IsOptional()
    @IsBoolean()
    requireSessionFingerprinting?: boolean;

    @ApiPropertyOptional({ description: 'Maximum failed login attempts before account lockout', minimum: 1, maximum: 20 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(20)
    maxFailedLoginAttempts?: number;

    @ApiPropertyOptional({ description: 'Lockout duration in minutes', minimum: 1, maximum: 1440 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1440)
    lockoutDuration?: number;

    @ApiPropertyOptional({ description: 'Enable refresh token replay attack detection' })
    @IsOptional()
    @IsBoolean()
    enableReplayDetection?: boolean;

    @ApiPropertyOptional({ description: 'Revoke compromised session upon replay detection' })
    @IsOptional()
    @IsBoolean()
    replayActionRevoke?: boolean;

    @ApiPropertyOptional({ description: 'Log security event upon replay detection' })
    @IsOptional()
    @IsBoolean()
    replayActionLog?: boolean;

    @ApiPropertyOptional({ description: 'Force logout user upon replay detection' })
    @IsOptional()
    @IsBoolean()
    replayActionLogout?: boolean;

    @ApiPropertyOptional({ description: 'Security events retention period in days', minimum: 1, maximum: 3650 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(3650)
    securityEventsRetention?: number;

    @ApiPropertyOptional({ description: 'Login history retention period in days', minimum: 1, maximum: 3650 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(3650)
    loginHistoryRetention?: number;

    @ApiPropertyOptional({ description: 'Logout history retention period in days', minimum: 1, maximum: 3650 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(3650)
    logoutHistoryRetention?: number;

    @ApiPropertyOptional({ description: 'Failed login attempts retention period in days', minimum: 1, maximum: 3650 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(3650)
    failedLoginRetention?: number;
}

export class UserSessionDto {
    @ApiProperty()
    loginSessionId: string;

    @ApiPropertyOptional()
    LoginSessionID?: string;

    @ApiProperty()
    userId: string;

    @ApiPropertyOptional()
    UserID?: string;

    @ApiProperty()
    ipAddress: string;

    @ApiPropertyOptional()
    IPAddress?: string;

    @ApiPropertyOptional()
    userAgent?: string | null;

    @ApiPropertyOptional()
    UserAgent?: string | null;

    @ApiPropertyOptional()
    deviceInfo?: string | null;

    @ApiPropertyOptional()
    DeviceInfo?: string | null;

    @ApiPropertyOptional()
    browserName?: string | null;

    @ApiPropertyOptional()
    BrowserName?: string | null;

    @ApiPropertyOptional()
    deviceType?: string | null;

    @ApiPropertyOptional()
    DeviceType?: string | null;

    @ApiProperty()
    loginAt: string;

    @ApiPropertyOptional()
    LoginAt?: string;

    @ApiProperty()
    expiresAt: string;

    @ApiPropertyOptional()
    ExpiresAt?: string;

    @ApiPropertyOptional()
    lastActivityAt?: string | null;

    @ApiPropertyOptional()
    LastActivityAt?: string | null;

    @ApiProperty()
    isActive: boolean;

    @ApiPropertyOptional()
    IsActive?: boolean;

    @ApiPropertyOptional()
    revokedAt?: string | null;

    @ApiPropertyOptional()
    RevokedAt?: string | null;
}

export class RevokeSessionsResponseDto {
    @ApiProperty({ default: true })
    success: boolean;

    @ApiPropertyOptional()
    message?: string;

    @ApiPropertyOptional()
    revokedSessions?: number;
}
