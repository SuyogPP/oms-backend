import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RetentionRepository {
  private readonly logger = new Logger(RetentionRepository.name);

  constructor(private readonly dataSource: DataSource) {}

  async purgeSecurityEvents(days: number): Promise<number> {
    const query = `
            DELETE FROM [auth].[tbl_Security_Events]
            WHERE created_at < DATEADD(DAY, -@0, SYSUTCDATETIME())
        `;
    const result = await this.dataSource.query(query, [days]);
    return typeof result?.[1] === 'number' ? result[1] : 0;
  }

  async purgeLoginHistory(days: number): Promise<number> {
    const query = `
            DELETE FROM [auth].[tbl_Login_History]
            WHERE login_at < DATEADD(DAY, -@0, SYSUTCDATETIME())
        `;
    const result = await this.dataSource.query(query, [days]);
    return typeof result?.[1] === 'number' ? result[1] : 0;
  }

  async purgeLogoutHistory(days: number): Promise<number> {
    const query = `
            DELETE FROM [auth].[tbl_Logout_History]
            WHERE logout_at < DATEADD(DAY, -@0, SYSUTCDATETIME())
        `;
    const result = await this.dataSource.query(query, [days]);
    return typeof result?.[1] === 'number' ? result[1] : 0;
  }

  async purgeFailedLogins(days: number): Promise<number> {
    const query = `
            DELETE FROM [auth].[tbl_Failed_Login_Attempts]
            WHERE attempted_at < DATEADD(DAY, -@0, SYSUTCDATETIME())
        `;
    const result = await this.dataSource.query(query, [days]);
    return typeof result?.[1] === 'number' ? result[1] : 0;
  }

  async purgeInactiveSessions(days: number): Promise<number> {
    const query = `
            DELETE FROM [auth].[tbl_Login_Sessions]
            WHERE (IsActive = 0 OR revoked_at IS NOT NULL OR expires_at < SYSUTCDATETIME())
            AND last_activity_at < DATEADD(DAY, -@0, SYSUTCDATETIME())
        `;
    const result = await this.dataSource.query(query, [days]);
    return typeof result?.[1] === 'number' ? result[1] : 0;
  }
}
