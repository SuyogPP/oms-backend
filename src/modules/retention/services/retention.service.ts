import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SECURITY_EVENTS } from '../../security-events/constants/security-events.constants';
import { SecurityEventsService } from '../../security-events/services/security-events.service';
import { SecuritySettingsService } from '../../security/services/security-settings.service';
import { RetentionCleanupResultDto } from '../dto/retention.dto';
import { RetentionRepository } from '../repositories/retention.repository';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly repository: RetentionRepository,
    private readonly securitySettingsService: SecuritySettingsService,
    private readonly securityEventsService: SecurityEventsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'data-retention-cleanup',
  })
  async handleCron(): Promise<void> {
    this.logger.log(
      'Executing automated daily data retention cleanup cron job...',
    );
    try {
      const result = await this.executeCleanup('CRON_SCHEDULER');
      this.logger.log(`Retention cleanup completed: ${result.message}`);
    } catch (error) {
      this.logger.error(
        `Automated retention cleanup failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  async executeCleanup(
    triggeredBy: string = 'MANUAL',
  ): Promise<RetentionCleanupResultDto> {
    this.logger.log(
      `[RETENTION] Starting retention cleanup job (triggered by: ${triggeredBy})...`,
    );

    const settings = await this.securitySettingsService.getSettings();

    const securityEventsDays = settings.securityEventsRetention || 365;
    const loginHistoryDays = settings.loginHistoryRetention || 365;
    const logoutHistoryDays = settings.logoutHistoryRetention || 365;
    const failedLoginsDays = settings.failedLoginRetention || 180;

    // 1. Purge Security Events
    const securityEventsDeleted =
      await this.repository.purgeSecurityEvents(securityEventsDays);

    // 2. Purge Login History
    const loginHistoryDeleted =
      await this.repository.purgeLoginHistory(loginHistoryDays);

    // 3. Purge Logout History
    const logoutHistoryDeleted =
      await this.repository.purgeLogoutHistory(logoutHistoryDays);

    // 4. Purge Failed Login Attempts
    const failedLoginsDeleted =
      await this.repository.purgeFailedLogins(failedLoginsDays);

    // 5. Purge Inactive Sessions
    const loginSessionsDeleted =
      await this.repository.purgeInactiveSessions(securityEventsDays);

    const totalDeleted =
      securityEventsDeleted +
      loginHistoryDeleted +
      logoutHistoryDeleted +
      failedLoginsDeleted +
      loginSessionsDeleted;

    const summary = `Deleted ${securityEventsDeleted} SecurityEvents, ${loginHistoryDeleted} LoginHistory rows, ${logoutHistoryDeleted} LogoutHistory rows, ${failedLoginsDeleted} FailedLoginAttempts, ${loginSessionsDeleted} InactiveSessions (Total: ${totalDeleted}).`;

    this.logger.log(`[RETENTION] Cleanup completed. ${summary}`);

    // Record security event
    await this.securityEventsService.log(
      SECURITY_EVENTS.RETENTION_JOB_EXECUTED,
      {
        description: `Retention Job Executed (${triggeredBy}): ${summary}`,
      },
    );

    return {
      success: true,
      message: `Retention cleanup executed successfully. ${summary}`,
      metrics: {
        securityEventsDeleted,
        loginHistoryDeleted,
        logoutHistoryDeleted,
        failedLoginsDeleted,
        loginSessionsDeleted,
        totalDeleted,
      },
      policies: {
        securityEventsRetention: securityEventsDays,
        loginHistoryRetention: loginHistoryDays,
        logoutHistoryRetention: logoutHistoryDays,
        failedLoginRetention: failedLoginsDays,
      },
      executedAt: new Date().toISOString(),
    };
  }
}
