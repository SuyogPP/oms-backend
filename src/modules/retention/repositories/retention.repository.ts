import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RetentionRepository {
  private readonly logger = new Logger(RetentionRepository.name);

  constructor(private readonly dataSource: DataSource) {}

  async purgeSecurityEvents(days: number): Promise<number> {
    const query = `
            DELETE FROM [auth].[SecurityEvents]
            WHERE CreatedAt < DATEADD(DAY, -@0, SYSUTCDATETIME())
        `;
    const result = await this.dataSource.query(query, [days]);
    return typeof result?.[1] === 'number' ? result[1] : 0;
  }

  async purgeLoginHistory(days: number): Promise<number> {
    const query = `
            DELETE FROM [auth].[LoginHistory]
            WHERE LoginAt < DATEADD(DAY, -@0, SYSUTCDATETIME())
        `;
    const result = await this.dataSource.query(query, [days]);
    return typeof result?.[1] === 'number' ? result[1] : 0;
  }

  async purgeLogoutHistory(days: number): Promise<number> {
    const query = `
            DELETE FROM [auth].[LogoutHistory]
            WHERE LogoutAt < DATEADD(DAY, -@0, SYSUTCDATETIME())
        `;
    const result = await this.dataSource.query(query, [days]);
    return typeof result?.[1] === 'number' ? result[1] : 0;
  }

  async purgeFailedLogins(days: number): Promise<number> {
    const query = `
            DELETE FROM [auth].[FailedLoginAttempts]
            WHERE AttemptedAt < DATEADD(DAY, -@0, SYSUTCDATETIME())
        `;
    const result = await this.dataSource.query(query, [days]);
    return typeof result?.[1] === 'number' ? result[1] : 0;
  }

  async purgeInactiveSessions(days: number): Promise<number> {
    const query = `
            DELETE FROM [auth].[LoginSessions]
            WHERE (IsActive = 0 OR RevokedAt IS NOT NULL OR ExpiresAt < SYSUTCDATETIME())
            AND LastActivityAt < DATEADD(DAY, -@0, SYSUTCDATETIME())
        `;
    const result = await this.dataSource.query(query, [days]);
    return typeof result?.[1] === 'number' ? result[1] : 0;
  }
}
