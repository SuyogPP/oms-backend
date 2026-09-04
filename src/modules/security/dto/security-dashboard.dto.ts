import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SecuritySummaryDto {
  @ApiProperty({
    description: 'Number of currently active, non-revoked sessions',
  })
  activeSessions: number;

  @ApiProperty({ description: 'Failed login attempts in the last 30 days' })
  failedLoginsLast30Days: number;

  @ApiProperty({ description: 'Successful logins in the last 30 days' })
  successfulLoginsLast30Days: number;

  @ApiProperty({ description: 'Security events recorded in the last 30 days' })
  securityEventsLast30Days: number;

  @ApiPropertyOptional({
    description: 'Timestamp of the last successful login',
  })
  lastLoginAt?: string | null;

  @ApiPropertyOptional({ description: 'Timestamp of the last logout' })
  lastLogoutAt?: string | null;

  @ApiProperty({ description: 'Whether the account is currently locked' })
  accountLocked: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp until which the account remains locked',
  })
  lockedUntil?: string | null;
}

export class SecurityDashboardSummaryDto {
  @ApiProperty()
  activeSessions: number;

  @ApiProperty()
  lockedUsers: number;

  @ApiProperty()
  failedLogins24Hours: number;

  @ApiProperty()
  successfulLogins24Hours: number;

  @ApiProperty()
  securityEvents24Hours: number;

  @ApiProperty()
  rateLimitEvents24Hours: number;

  @ApiProperty()
  activeUsersToday: number;

  @ApiProperty()
  revokedSessions24Hours: number;

  @ApiProperty()
  refreshTokenReplayEvents24Hours: number;
}

export class SecurityEventDto {
  @ApiProperty()
  securityEventId: number;

  @ApiPropertyOptional()
  SecurityEventID?: number;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiPropertyOptional()
  UserID?: string | null;

  @ApiPropertyOptional()
  loginSessionId?: string | null;

  @ApiPropertyOptional()
  LoginSessionID?: string | null;

  @ApiProperty()
  eventType: string;

  @ApiPropertyOptional()
  EventType?: string;

  @ApiPropertyOptional()
  eventDescription?: string | null;

  @ApiPropertyOptional()
  EventDescription?: string | null;

  @ApiPropertyOptional()
  ipAddress?: string | null;

  @ApiPropertyOptional()
  IPAddress?: string | null;

  @ApiPropertyOptional()
  userAgent?: string | null;

  @ApiPropertyOptional()
  UserAgent?: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiPropertyOptional()
  CreatedAt?: string;
}

export class FailedLoginAttemptDto {
  @ApiProperty()
  failedLoginAttemptId: number;

  @ApiPropertyOptional()
  FailedLoginAttemptID?: number;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiPropertyOptional()
  UserID?: string | null;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  Username?: string | null;

  @ApiProperty()
  ipAddress: string;

  @ApiPropertyOptional()
  IPAddress?: string;

  @ApiPropertyOptional()
  failureReason?: string | null;

  @ApiPropertyOptional()
  FailureReason?: string | null;

  @ApiProperty()
  attemptedAt: string;

  @ApiPropertyOptional()
  AttemptedAt?: string;

  @ApiPropertyOptional()
  browserName?: string | null;

  @ApiPropertyOptional()
  BrowserName?: string | null;

  @ApiPropertyOptional()
  deviceType?: string | null;

  @ApiPropertyOptional()
  DeviceType?: string | null;
}

export class ActiveSessionDto {
  @ApiProperty()
  loginSessionId: string;

  @ApiPropertyOptional()
  LoginSessionID?: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  UserID?: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional()
  Username?: string;

  @ApiProperty()
  ipAddress: string;

  @ApiPropertyOptional()
  IPAddress?: string;

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

  @ApiPropertyOptional()
  lastActivityAt?: string | null;

  @ApiPropertyOptional()
  LastActivityAt?: string | null;

  @ApiProperty()
  loginAt: string;

  @ApiPropertyOptional()
  LoginAt?: string;

  @ApiProperty()
  expiresAt: string;

  @ApiPropertyOptional()
  ExpiresAt?: string;

  @ApiPropertyOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  IsActive?: boolean;
}

export class SecurityDashboardDataDto {
  @ApiProperty({ type: SecurityDashboardSummaryDto })
  summary: SecurityDashboardSummaryDto;

  @ApiProperty({ type: [SecurityEventDto] })
  events: SecurityEventDto[];

  @ApiProperty({ type: [FailedLoginAttemptDto] })
  failedLogins: FailedLoginAttemptDto[];

  @ApiProperty({ type: [ActiveSessionDto] })
  activeSessions: ActiveSessionDto[];
}

// Chart DTOs
export class FailedLoginsChartDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  count: number;
}

export class SecurityEventsByTypeDto {
  @ApiProperty()
  eventType: string;

  @ApiProperty()
  count: number;
}

export class SessionsByDeviceDto {
  @ApiProperty()
  device: string;

  @ApiProperty()
  count: number;
}

export class SessionsByRoleDto {
  @ApiProperty()
  role: string;

  @ApiProperty()
  count: number;
}

export class LoginTrendDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  success: number;

  @ApiProperty()
  failure: number;
}

export class ReplayEventsDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  count: number;
}

export class LockedAccountsDto {
  @ApiProperty()
  username: string;

  @ApiProperty()
  lockouts: number;
}

export class SessionsCreatedPerDayDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  count: number;
}
