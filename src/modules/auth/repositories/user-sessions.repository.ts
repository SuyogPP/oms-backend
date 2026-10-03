import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface RawUserSessionRow {
  LoginSessionID: string;
  IPAddress: string;
  BrowserName: string | null;
  DeviceType: string | null;
  LoginAt: Date;
  LastActivityAt: Date | null;
  ExpiresAt: Date;
  IsActive: boolean;
}

export interface RawSessionDetailRow {
  LoginSessionID: string;
  UserID: string;
  Username: string | null;
  IPAddress: string;
  UserAgent: string | null;
  IsActive: boolean;
  RevokedAt: Date | null;
  ExpiresAt: Date;
}

export interface CreateLogoutHistoryInput {
  loginSessionId: string;
  userId: string;
  username?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  logoutReason: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class UserSessionsRepository {
  private readonly logger = new Logger(UserSessionsRepository.name);

  constructor(private readonly dataSource: DataSource) {}

  async getActiveSessionsByUserId(
    userId: string,
  ): Promise<RawUserSessionRow[]> {
    const validUserId = UUID_REGEX.test(userId) ? userId : null;
    if (!validUserId) return [];

    const query = `
            SELECT
                LoginSessionID,
                IPAddress,
                BrowserName,
                DeviceType,
                LoginAt,
                LastActivityAt,
                ExpiresAt,
                IsActive
            FROM [auth].[tbl_Login_Sessions]
            WHERE user_id = @0
            AND is_active = 1
            AND revoked_at IS NULL
            AND expires_at > SYSUTCDATETIME()
            ORDER BY last_activity_at DESC, LoginAt DESC
        `;

    return this.dataSource.query(query, [validUserId]);
  }

  async getSessionById(sessionId: string): Promise<RawSessionDetailRow | null> {
    const validSessionId = UUID_REGEX.test(sessionId) ? sessionId : null;
    if (!validSessionId) return null;

    const query = `
            SELECT TOP 1
                ls.login_session_id,
                ls.user_id,
                u.Username,
                ls.IPAddress,
                ls.user_agent,
                ls.is_active,
                ls.revoked_at,
                ls.expires_at
            FROM [auth].[tbl_Login_Sessions] ls
            LEFT JOIN [auth].[tbl_Users] u ON u.user_id = ls.user_id
            WHERE ls.login_session_id = @0
        `;

    const rows = await this.dataSource.query(query, [validSessionId]);
    return rows[0] || null;
  }

  async revokeSession(sessionId: string): Promise<number> {
    const validSessionId = UUID_REGEX.test(sessionId) ? sessionId : null;
    if (!validSessionId) return 0;

    const query = `
            UPDATE [auth].[tbl_Login_Sessions]
            SET
                IsActive = 0,
                RevokedAt = SYSUTCDATETIME(),
                RefreshTokenRevokedAt = SYSUTCDATETIME()
            WHERE login_session_id = @0
            AND (IsActive = 1 OR revoked_at IS NULL)
        `;

    const result = await this.dataSource.query(query, [validSessionId]);
    return typeof result?.[1] === 'number' ? result[1] : 1;
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<RawSessionDetailRow[]> {
    const validUserId = UUID_REGEX.test(userId) ? userId : null;
    const validCurrentSessionId = UUID_REGEX.test(currentSessionId)
      ? currentSessionId
      : null;
    if (!validUserId) return [];

    // First find sessions to revoke so we can log history
    const findQuery = `
            SELECT
                ls.login_session_id,
                ls.user_id,
                u.Username,
                ls.IPAddress,
                ls.user_agent,
                ls.is_active,
                ls.revoked_at,
                ls.expires_at
            FROM [auth].[tbl_Login_Sessions] ls
            LEFT JOIN [auth].[tbl_Users] u ON u.user_id = ls.user_id
            WHERE ls.user_id = @0
            AND (ls.login_session_id <> @1 OR @1 IS NULL)
            AND ls.is_active = 1
        `;

    const sessionsToRevoke = await this.dataSource.query(findQuery, [
      validUserId,
      validCurrentSessionId,
    ]);

    const updateQuery = `
            UPDATE [auth].[tbl_Login_Sessions]
            SET
                IsActive = 0,
                RevokedAt = SYSUTCDATETIME(),
                RefreshTokenRevokedAt = SYSUTCDATETIME()
            WHERE user_id = @0
            AND (LoginSessionID <> @1 OR @1 IS NULL)
            AND is_active = 1
        `;

    await this.dataSource.query(updateQuery, [
      validUserId,
      validCurrentSessionId,
    ]);
    return sessionsToRevoke;
  }

  async createLogoutHistory(data: CreateLogoutHistoryInput): Promise<void> {
    try {
      const validUserId = UUID_REGEX.test(data.userId) ? data.userId : null;
      const validSessionId = UUID_REGEX.test(data.loginSessionId)
        ? data.loginSessionId
        : null;

      const query = `
                INSERT INTO [auth].[tbl_Logout_History]
                (
                    LoginSessionID,
                    UserID,
                    Username,
                    IPAddress,
                    UserAgent,
                    LogoutAt,
                    LogoutReason
                )
                VALUES
                (
                    @0,
                    @1,
                    @2,
                    @3,
                    @4,
                    SYSUTCDATETIME(),
                    @5
                )
            `;

      await this.dataSource.query(query, [
        validSessionId,
        validUserId,
        data.username ?? 'Unknown',
        data.ipAddress ?? null,
        data.userAgent ?? null,
        data.logoutReason,
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to write LogoutHistory for session ${data.loginSessionId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
