import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserSessionDto } from '../dto/security-settings.dto';

export interface RawSecuritySettingRow {
  SettingCode: string;
  SettingValue: string;
  SettingType: string;
  Description?: string;
  IsEditable: boolean;
  UpdatedAt?: Date;
  UpdatedBy?: string;
}

@Injectable()
export class SecuritySettingsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getAllSettings(): Promise<RawSecuritySettingRow[]> {
    const query = `
            SELECT
                SettingCode,
                SettingValue,
                SettingType,
                Description,
                IsEditable,
                UpdatedAt,
                UpdatedBy
            FROM [auth].[SecuritySettings]
        `;
    return this.dataSource.query(query);
  }

  async updateSetting(
    settingCode: string,
    settingValue: string,
    updatedBy?: string | null,
  ): Promise<void> {
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validUpdatedBy =
      updatedBy && UUID_REGEX.test(updatedBy) ? updatedBy : null;

    const query = `
            UPDATE [auth].[SecuritySettings]
            SET
                SettingValue = @1,
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @2
            WHERE SettingCode = @0
        `;
    await this.dataSource.query(query, [
      settingCode,
      settingValue,
      validUpdatedBy,
    ]);
  }

  async getSessionsByUserId(userId: string): Promise<UserSessionDto[]> {
    const query = `
            SELECT
                LoginSessionID,
                UserID,
                IPAddress,
                UserAgent,
                DeviceInfo,
                BrowserName,
                DeviceType,
                LoginAt,
                ExpiresAt,
                LastActivityAt,
                IsActive,
                RevokedAt
            FROM [auth].[LoginSessions]
            WHERE UserID = @0
            ORDER BY LoginAt DESC
        `;

    const rows = await this.dataSource.query(query, [userId]);
    return rows.map((row: any) => ({
      loginSessionId: row.LoginSessionID,
      LoginSessionID: row.LoginSessionID,
      userId: row.UserID,
      UserID: row.UserID,
      ipAddress: row.IPAddress,
      IPAddress: row.IPAddress,
      userAgent: row.UserAgent || null,
      UserAgent: row.UserAgent || null,
      deviceInfo: row.DeviceInfo || null,
      DeviceInfo: row.DeviceInfo || null,
      browserName: row.BrowserName || null,
      BrowserName: row.BrowserName || null,
      deviceType: row.DeviceType || null,
      DeviceType: row.DeviceType || null,
      loginAt: new Date(row.LoginAt).toISOString(),
      LoginAt: new Date(row.LoginAt).toISOString(),
      expiresAt: new Date(row.ExpiresAt).toISOString(),
      ExpiresAt: new Date(row.ExpiresAt).toISOString(),
      lastActivityAt: row.LastActivityAt
        ? new Date(row.LastActivityAt).toISOString()
        : null,
      LastActivityAt: row.LastActivityAt
        ? new Date(row.LastActivityAt).toISOString()
        : null,
      isActive: Boolean(row.IsActive),
      IsActive: Boolean(row.IsActive),
      revokedAt: row.RevokedAt ? new Date(row.RevokedAt).toISOString() : null,
      RevokedAt: row.RevokedAt ? new Date(row.RevokedAt).toISOString() : null,
    }));
  }

  async revokeSession(sessionId: string): Promise<number> {
    const query = `
            UPDATE [auth].[LoginSessions]
            SET
                IsActive = 0,
                RevokedAt = SYSUTCDATETIME(),
                RefreshTokenRevokedAt = SYSUTCDATETIME()
            WHERE LoginSessionID = @0
            AND (IsActive = 1 OR RevokedAt IS NULL)
        `;
    const result = await this.dataSource.query(query, [sessionId]);
    return typeof result?.[1] === 'number' ? result[1] : 1;
  }

  async revokeAllSessionsForUser(userId: string): Promise<number> {
    const query = `
            UPDATE [auth].[LoginSessions]
            SET
                IsActive = 0,
                RevokedAt = SYSUTCDATETIME(),
                RefreshTokenRevokedAt = SYSUTCDATETIME()
            WHERE UserID = @0
            AND (IsActive = 1 OR RevokedAt IS NULL)
        `;
    const result = await this.dataSource.query(query, [userId]);
    return typeof result?.[1] === 'number' ? result[1] : 1;
  }

  async revokeAllSessionsSystemWide(): Promise<number> {
    const query = `
            UPDATE [auth].[LoginSessions]
            SET
                IsActive = 0,
                RevokedAt = SYSUTCDATETIME(),
                RefreshTokenRevokedAt = SYSUTCDATETIME()
            WHERE IsActive = 1
        `;
    const result = await this.dataSource.query(query);
    return typeof result?.[1] === 'number' ? result[1] : 1;
  }
}
