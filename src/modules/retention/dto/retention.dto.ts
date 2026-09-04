import { ApiProperty } from '@nestjs/swagger';

export class RetentionMetricsDto {
  @ApiProperty({ description: 'Number of purged SecurityEvents rows' })
  securityEventsDeleted: number;

  @ApiProperty({ description: 'Number of purged LoginHistory rows' })
  loginHistoryDeleted: number;

  @ApiProperty({ description: 'Number of purged LogoutHistory rows' })
  logoutHistoryDeleted: number;

  @ApiProperty({ description: 'Number of purged FailedLoginAttempts rows' })
  failedLoginsDeleted: number;

  @ApiProperty({ description: 'Number of purged inactive LoginSessions rows' })
  loginSessionsDeleted: number;

  @ApiProperty({ description: 'Total number of purged rows across all tables' })
  totalDeleted: number;
}

export class RetentionPoliciesDto {
  @ApiProperty({ description: 'Retention window for SecurityEvents in days' })
  securityEventsRetention: number;

  @ApiProperty({ description: 'Retention window for LoginHistory in days' })
  loginHistoryRetention: number;

  @ApiProperty({ description: 'Retention window for LogoutHistory in days' })
  logoutHistoryRetention: number;

  @ApiProperty({
    description: 'Retention window for FailedLoginAttempts in days',
  })
  failedLoginRetention: number;
}

export class RetentionCleanupResultDto {
  @ApiProperty({ default: true })
  success: boolean;

  @ApiProperty({ description: 'Summary message of the cleanup operation' })
  message: string;

  @ApiProperty({ type: RetentionMetricsDto })
  metrics: RetentionMetricsDto;

  @ApiProperty({ type: RetentionPoliciesDto })
  policies: RetentionPoliciesDto;

  @ApiProperty({ description: 'Timestamp when the cleanup was executed' })
  executedAt: string;
}
