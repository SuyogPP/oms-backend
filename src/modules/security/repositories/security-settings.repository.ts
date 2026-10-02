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
            FROM [auth].tbl_Security_Settings]
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
            UPDATE [auth].tbl_Security_Settings]
            SET
                SettingValue = @1,
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @2
            WHERE setting_code = @0
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
            FROM [auth].tbl_Login_Sessions]
            WHERE user_id = @0
            ORDER BY login_at DESC
        `;

    const rows = await this.dataSource.query(query, [userId]);
    return rows.map((row: any) => ({
      loginSessionId: row.login_session_id,
      LoginSessionID: row.login_session_id,
      userId: row.user_id,
      UserID: row.user_id,
      ipAddress: row.IPAddress,
      IPAddress: row.IPAddress,
      userAgent: row.user_agent || null,
      UserAgent: row.user_agent || null,
      deviceInfo: row.device_info || null,
      DeviceInfo: row.device_info || null,
      browserName: row.browser_name || null,
      BrowserName: row.browser_name || null,
      deviceType: row.device_type || null,
      DeviceType: row.device_type || null,
      loginAt: new Date(row.login_at).toISOString(),
      LoginAt: new Date(row.login_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      ExpiresAt: new Date(row.expires_at).toISOString(),
      lastActivityAt: row.last_activity_at
        ? new Date(row.last_activity_at).toISOString()
        : null,
      LastActivityAt: row.last_activity_at
        ? new Date(row.last_activity_at).toISOString()
        : null,
      isActive: Boolean(row.is_active),
      IsActive: Boolean(row.is_active),
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
      RevokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    }));
  }

  async revokeSession(sessionId: string): Promise<number> {
    const query = `
            UPDATE [auth].tbl_Login_Sessions]
            SET
                IsActive = 0,
                RevokedAt = SYSUTCDATETIME(),
                RefreshTokenRevokedAt = SYSUTCDATETIME()
            WHERE login_session_id = @0
            AND (IsActive = 1 OR revoked_at IS NULL)
        `;
    const result = await this.dataSource.query(query, [sessionId]);
    return typeof result?.[1] === 'number' ? result[1] : 1;
  }

  async revokeAllSessionsForUser(userId: string): Promise<number> {
    const query = `
            UPDATE [auth].tbl_Login_Sessions]
            SET
                IsActive = 0,
                RevokedAt = SYSUTCDATETIME(),
                RefreshTokenRevokedAt = SYSUTCDATETIME()
            WHERE user_id = @0
            AND (IsActive = 1 OR revoked_at IS NULL)
        `;
    const result = await this.dataSource.query(query, [userId]);
    return typeof result?.[1] === 'number' ? result[1] : 1;
  }

  async revokeAllSessionsSystemWide(): Promise<number> {
    const query = `
            UPDATE [auth].tbl_Login_Sessions]
            SET
                IsActive = 0,
                RevokedAt = SYSUTCDATETIME(),
                RefreshTokenRevokedAt = SYSUTCDATETIME()
            WHERE is_active = 1
        `;
    const result = await this.dataSource.query(query);
    return typeof result?.[1] === 'number' ? result[1] : 1;
  }
}
