import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IPasswordHistory } from '../interfaces/users.interface';
import {
  PASSWORD_HISTORY_CHECK_COUNT,
  PASSWORD_HISTORY_MAX_COUNT,
} from '../users.constants';

@Injectable()
export class PasswordHistoryRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Adds a new entry into auth.PasswordHistory.
   */
  async add(
    userId: string,
    passwordHash: string,
    qr?: QueryRunner,
  ): Promise<string> {
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].[PasswordHistory] (
          PasswordHistoryID,
          UserID,
          PasswordHash,
          CreatedAt
      )
      OUTPUT INSERTED.PasswordHistoryID AS passwordHistoryId
      VALUES (
          NEWID(),
          @0,
          @1,
          SYSUTCDATETIME()
      );
      `,
      [userId, passwordHash],
    );

    return rows[0].passwordHistoryId;
  }

  /**
   * Retrieves recent password hashes for a user to prevent reuse (§5.3).
   */
  async getRecent(
    userId: string,
    count: number = PASSWORD_HISTORY_CHECK_COUNT,
    qr?: QueryRunner,
  ): Promise<IPasswordHistory[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP (@1)
          ph.PasswordHistoryID AS passwordHistoryId,
          ph.UserID AS userId,
          ph.PasswordHash AS passwordHash,
          ph.CreatedAt AS changedAt
      FROM [auth].[PasswordHistory] ph
      WHERE ph.UserID = @0
      ORDER BY ph.CreatedAt DESC;
      `,
      [userId, count],
    );

    return rows.map((r: any) => ({
      passwordHistoryId: r.passwordHistoryId,
      userId: r.userId,
      passwordHash: r.passwordHash,
      changedAt: new Date(r.changedAt),
    }));
  }

  /**
   * Prunes old history keeping only the latest keepCount entries.
   */
  async prune(
    userId: string,
    keepCount: number = PASSWORD_HISTORY_MAX_COUNT,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      WITH RankedHistory AS (
          SELECT 
              PasswordHistoryID,
              ROW_NUMBER() OVER (ORDER BY CreatedAt DESC) as rn
          FROM [auth].[PasswordHistory]
          WHERE UserID = @0
      )
      DELETE FROM [auth].[PasswordHistory]
      WHERE PasswordHistoryID IN (
          SELECT PasswordHistoryID 
          FROM RankedHistory 
          WHERE rn > @1
      );
      `,
      [userId, keepCount],
    );
  }
}
