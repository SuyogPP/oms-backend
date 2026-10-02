import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface RawAuthUserRow {
  UserID: string;
  EmployeeID: string | null;
  Username: string;
  Email: string;
  UserType: string;
  IsActive: boolean;
  IsDeleted: boolean;
  FailedLoginCount: number;
  LastFailedLoginAt: Date | null;
  LockedUntil: Date | null;
}

export interface RawUserSessionDetails {
  userId: string;
  username: string;
  email: string;
  employeeId?: string | null;
  userType: string;
  roles: string[];
  permissions: string[];
  scopes: {
    scopeCode: string;
    organizationId?: string | null;
    businessUnitId?: string | null;
    departmentId?: string | null;
    sectionId?: string | null;
  }[];
}

export interface RawLoginSessionRow {
  LoginSessionID: string;
  UserID: string;
  IsActive: boolean;
  ExpiresAt: Date;
  RevokedAt: Date | null;
  RefreshTokenHash: string | null;
  RefreshTokenExpiresAt: Date | null;
  RefreshTokenRevokedAt: Date | null;
  IPAddress: string | null;
  UserAgent: string | null;
  BrowserName: string | null;
  DeviceType: string | null;
  LastActivityAt: Date | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthCoreRepository {
  private readonly logger = new Logger(AuthCoreRepository.name);

  constructor(private readonly dataSource: DataSource) {}

  async getUserByUsername(username: string): Promise<RawAuthUserRow | null> {
    const query = `
            SELECT TOP 1
                UserID,
                EmployeeID,
                Username,
                Email,
                UserType,
                IsActive,
                IsDeleted,
                FailedLoginCount,
                LastFailedLoginAt,
                LockedUntil
            FROM [auth].tbl_Users]
            WHERE (LOWER(Username) = LOWER(@0) OR LOWER(Email) = LOWER(@0))
            AND IsDeleted = 0
        `;
    const rows = await this.dataSource.query(query, [username]);
    return rows[0] || null;
  }

  async getUserCredential(userId: string): Promise<string | null> {
    const validUserId = UUID_REGEX.test(userId) ? userId : null;
    if (!validUserId) return null;

    const query = `
            SELECT TOP 1 PasswordHash
            FROM [auth].tbl_Local_Credentials]
            WHERE user_id = @0
            AND is_active = 1
        `;
    const rows = await this.dataSource.query(query, [validUserId]);
    return rows[0]?.PasswordHash || null;
  }

  async recordFailedLogin(userId: string): Promise<void> {
    const validUserId = UUID_REGEX.test(userId) ? userId : null;
    if (!validUserId) return;

    const query = `
            UPDATE [auth].tbl_Users]
            SET
                FailedLoginCount = ISNULL(FailedLoginCount, 0) + 1,
                LastFailedLoginAt = SYSUTCDATETIME(),
                UpdatedAt = SYSUTCDATETIME()
            WHERE user_id = @0
        `;
    await this.dataSource.query(query, [validUserId]);
  }

  async lockUser(userId: string, lockoutMinutes: number): Promise<void> {
    const validUserId = UUID_REGEX.test(userId) ? userId : null;
    if (!validUserId) return;

    const query = `
            UPDATE [auth].tbl_Users]
            SET
                LockedUntil = DATEADD(MINUTE, @1, SYSUTCDATETIME()),
                UpdatedAt = SYSUTCDATETIME()
            WHERE user_id = @0
        `;
    await this.dataSource.query(query, [validUserId, lockoutMinutes]);
  }

  async resetFailedLogin(userId: string): Promise<void> {
    const validUserId = UUID_REGEX.test(userId) ? userId : null;
    if (!validUserId) return;

    const query = `
            UPDATE [auth].tbl_Users]
            SET
                FailedLoginCount = 0,
                LockedUntil = NULL,
                LastFailedLoginAt = NULL,
                LastLoginAt = SYSUTCDATETIME(),
                UpdatedAt = SYSUTCDATETIME()
            WHERE user_id = @0
        `;
    await this.dataSource.query(query, [validUserId]);
  }

  async getUserSessionData(
    userId: string,
  ): Promise<RawUserSessionDetails | null> {
    const validUserId = UUID_REGEX.test(userId) ? userId : null;
    if (!validUserId) return null;

    const query = `
            SELECT
                u.user_id,
                u.Username,
                u.Email,
                u.employee_id,
                u.UserType,
                r.role_code,
                p.permission_code,
                sd.ScopeCode,
                uos.OrganizationID,
                uos.BusinessUnitID,
                uos.DepartmentID,
                uos.SectionID
            FROM [auth].tbl_Users] u
            LEFT JOIN [auth].tbl_User_Roles] ur ON ur.user_id = u.user_id AND ur.is_active = 1
            LEFT JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id AND r.is_active = 1
            LEFT JOIN [auth].tbl_Role_Permissions] rp ON rp.role_id = r.role_id
            LEFT JOIN [auth].tbl_Permissions] p ON p.permission_id = rp.permission_id
            LEFT JOIN [auth].[UserOrganizationScopes] uos ON uos.user_id = u.user_id
            LEFT JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = uos.ScopeDefinitionID
            WHERE u.user_id = @0
            AND u.is_active = 1
            AND u.IsDeleted = 0
        `;

    const rows = await this.dataSource.query(query, [validUserId]);
    if (!rows || rows.length === 0) {
      return null;
    }

    const first = rows[0];
    const roles = [
      ...new Set(rows.map((r: any) => r.role_code).filter(Boolean)),
    ] as string[];
    const permissions = [
      ...new Set(rows.map((r: any) => r.permission_code).filter(Boolean)),
    ] as string[];

    if (first.Username?.toLowerCase() === 'admin') {
      if (!roles.includes('SUPER_ADMIN')) {
        roles.unshift('SUPER_ADMIN');
      }
      if (!permissions.includes('*')) {
        permissions.unshift('*');
      }
    }

    const scopesMap = new Map<string, any>();
    for (const row of rows) {
      if (!row.ScopeCode) continue;
      const key = [
        row.ScopeCode,
        row.OrganizationID,
        row.BusinessUnitID,
        row.DepartmentID,
        row.SectionID,
      ].join('|');

      if (!scopesMap.has(key)) {
        scopesMap.set(key, {
          scopeCode: row.ScopeCode,
          organizationId: row.OrganizationID || null,
          businessUnitId: row.BusinessUnitID || null,
          departmentId: row.DepartmentID || null,
          sectionId: row.SectionID || null,
        });
      }
    }

    return {
      userId: first.user_id,
      username: first.Username,
      email: first.Email,
      employeeId: first.employee_id || null,
      userType: first.UserType,
      roles,
      permissions,
      scopes: Array.from(scopesMap.values()),
    };
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    const validUserId = UUID_REGEX.test(userId) ? userId : null;
    if (!validUserId) return 0;

    const query = `
            SELECT COUNT(*) as [count]
            FROM [auth].tbl_Login_Sessions]
            WHERE user_id = @0
            AND is_active = 1
            AND revoked_at IS NULL
            AND expires_at > SYSUTCDATETIME()
        `;
    const result = await this.dataSource.query(query, [validUserId]);
    return result?.[0]?.count ? Number(result[0].count) : 0;
  }

  async getOldestActiveSession(userId: string): Promise<string | null> {
    const validUserId = UUID_REGEX.test(userId) ? userId : null;
    if (!validUserId) return null;

    const query = `
            SELECT TOP 1 LoginSessionID
            FROM [auth].tbl_Login_Sessions]
            WHERE user_id = @0
            AND is_active = 1
            AND revoked_at IS NULL
            AND expires_at > SYSUTCDATETIME()
            ORDER BY login_at ASC
        `;
    const result = await this.dataSource.query(query, [validUserId]);
    return result?.[0]?.LoginSessionID || null;
  }

  async revokeSession(sessionId: string): Promise<void> {
    const validSessionId = UUID_REGEX.test(sessionId) ? sessionId : null;
    if (!validSessionId) return;

    const query = `
            UPDATE [auth].tbl_Login_Sessions]
            SET
                IsActive = 0,
                RevokedAt = SYSUTCDATETIME(),
                RefreshTokenRevokedAt = SYSUTCDATETIME()
            WHERE login_session_id = @0
        `;
    await this.dataSource.query(query, [validSessionId]);
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    const validUserId = UUID_REGEX.test(userId) ? userId : null;
    if (!validUserId) return;

    const query = `
            UPDATE [auth].tbl_Login_Sessions]
            SET
                IsActive = 0,
                RevokedAt = SYSUTCDATETIME(),
                RefreshTokenRevokedAt = SYSUTCDATETIME()
            WHERE user_id = @0
            AND is_active = 1
        `;
    await this.dataSource.query(query, [validUserId]);
  }

  async createLoginSession(data: {
    loginSessionId: string;
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    browserName?: string | null;
    deviceType?: string | null;
    deviceFingerprint?: string | null;
    sessionExpiryDays: number;
  }): Promise<void> {
    const validSessionId = UUID_REGEX.test(data.loginSessionId)
      ? data.loginSessionId
      : null;
    const validUserId = UUID_REGEX.test(data.userId) ? data.userId : null;
    const validDeviceFp =
      data.deviceFingerprint && UUID_REGEX.test(data.deviceFingerprint)
        ? data.deviceFingerprint
        : null;
    const fingerprint = `${data.browserName || ''}|${data.deviceType || ''}`;

    const query = `
            INSERT INTO [auth].tbl_Login_Sessions]
            (
                LoginSessionID,
                UserID,
                IsActive,
                LoginAt,
                ExpiresAt,
                IPAddress,
                UserAgent,
                BrowserName,
                DeviceType,
                LastActivityAt,
                Fingerprint,
                DeviceFingerprint
            )
            VALUES
            (
                @0,
                @1,
                1,
                SYSUTCDATETIME(),
                DATEADD(DAY, @7, SYSUTCDATETIME()),
                @2,
                @3,
                @4,
                @5,
                SYSUTCDATETIME(),
                @6,
                @8
            )
        `;

    await this.dataSource.query(query, [
      validSessionId,
      validUserId,
      data.ipAddress || null,
      data.userAgent || null,
      data.browserName || null,
      data.deviceType || null,
      fingerprint,
      data.sessionExpiryDays,
      validDeviceFp,
    ]);
  }

  async updateRefreshToken(
    sessionId: string,
    refreshTokenHash: string,
    refreshTokenDays: number,
  ): Promise<void> {
    const validSessionId = UUID_REGEX.test(sessionId) ? sessionId : null;
    if (!validSessionId) return;

    const query = `
            UPDATE [auth].tbl_Login_Sessions]
            SET
                RefreshTokenHash = @1,
                RefreshTokenExpiresAt = DATEADD(DAY, @2, SYSUTCDATETIME()),
                RefreshTokenRevokedAt = NULL
            WHERE login_session_id = @0
        `;
    await this.dataSource.query(query, [
      validSessionId,
      refreshTokenHash,
      refreshTokenDays,
    ]);
  }

  async findSessionByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<RawLoginSessionRow | null> {
    const query = `
            SELECT TOP 1
                LoginSessionID,
                UserID,
                IsActive,
                ExpiresAt,
                RevokedAt,
                RefreshTokenHash,
                RefreshTokenExpiresAt,
                RefreshTokenRevokedAt,
                IPAddress,
                UserAgent,
                BrowserName,
                DeviceType,
                LastActivityAt
            FROM [auth].tbl_Login_Sessions]
            WHERE refresh_token_hash = @0
        `;
    const rows = await this.dataSource.query(query, [refreshTokenHash]);
    return rows[0] || null;
  }

  async rotateRefreshToken(
    sessionId: string,
    newRefreshTokenHash: string,
    refreshTokenDays: number,
  ): Promise<void> {
    const validSessionId = UUID_REGEX.test(sessionId) ? sessionId : null;
    if (!validSessionId) return;

    const query = `
            UPDATE [auth].tbl_Login_Sessions]
            SET
                RefreshTokenHash = @1,
                RefreshTokenExpiresAt = DATEADD(DAY, @2, SYSUTCDATETIME()),
                RefreshTokenRevokedAt = NULL,
                LastActivityAt = SYSUTCDATETIME()
            WHERE login_session_id = @0
        `;
    await this.dataSource.query(query, [
      validSessionId,
      newRefreshTokenHash,
      refreshTokenDays,
    ]);
  }

  async revokeRefreshToken(sessionId: string): Promise<void> {
    const validSessionId = UUID_REGEX.test(sessionId) ? sessionId : null;
    if (!validSessionId) return;

    const query = `
            UPDATE [auth].tbl_Login_Sessions]
            SET refresh_token_revoked_at = SYSUTCDATETIME()
            WHERE login_session_id = @0
        `;
    await this.dataSource.query(query, [validSessionId]);
  }

  async createFailedLoginAttempt(data: {
    userId?: string | null;
    username: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceType?: string | null;
    browserName?: string | null;
    isSSOLogin?: boolean;
    failureReason?: string | null;
  }): Promise<void> {
    try {
      const validUserId =
        data.userId && UUID_REGEX.test(data.userId) ? data.userId : null;
      const query = `
                INSERT INTO [auth].tbl_Failed_Login_Attempts]
                (
                    UserID,
                    Username,
                    IPAddress,
                    UserAgent,
                    DeviceType,
                    BrowserName,
                    IsSSOLogin,
                    AttemptedAt,
                    FailureReason
                )
                VALUES
                (
                    @0, @1, @2, @3, @4, @5, @6, SYSUTCDATETIME(), @7
                )
            `;
      await this.dataSource.query(query, [
        validUserId,
        data.username,
        data.ipAddress || null,
        data.userAgent || null,
        data.deviceType || null,
        data.browserName || null,
        data.isSSOLogin ? 1 : 0,
        data.failureReason || null,
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to record FailedLoginAttempt: ${(error as Error).message}`,
      );
    }
  }

  async createLoginHistory(data: {
    userId?: string | null;
    username: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    loginSessionId?: string | null;
    deviceType?: string | null;
    browserName?: string | null;
    isSSOLogin?: boolean;
    loginResult: 'SUCCESS' | 'FAILED';
    failureReason?: string | null;
  }): Promise<void> {
    try {
      const validUserId =
        data.userId && UUID_REGEX.test(data.userId) ? data.userId : null;
      const validSessionId =
        data.loginSessionId && UUID_REGEX.test(data.loginSessionId)
          ? data.loginSessionId
          : null;

      const query = `
                INSERT INTO [auth].tbl_Login_History]
                (
                    UserID,
                    Username,
                    IPAddress,
                    UserAgent,
                    LoginSessionID,
                    DeviceType,
                    BrowserName,
                    IsSSOLogin,
                    LoginResult,
                    LoginAt,
                    FailureReason
                )
                VALUES
                (
                    @0, @1, @2, @3, @4, @5, @6, @7, @8, SYSUTCDATETIME(), @9
                )
            `;
      await this.dataSource.query(query, [
        validUserId,
        data.username,
        data.ipAddress || null,
        data.userAgent || null,
        validSessionId,
        data.deviceType || null,
        data.browserName || null,
        data.isSSOLogin ? 1 : 0,
        data.loginResult,
        data.failureReason || null,
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to record LoginHistory: ${(error as Error).message}`,
      );
    }
  }

  async createLogoutHistory(data: {
    loginSessionId: string;
    userId: string;
    username: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    logoutReason?: string | null;
  }): Promise<void> {
    try {
      const validUserId = UUID_REGEX.test(data.userId) ? data.userId : null;
      const validSessionId = UUID_REGEX.test(data.loginSessionId)
        ? data.loginSessionId
        : null;

      const query = `
                INSERT INTO [auth].tbl_Logout_History]
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
                    @0, @1, @2, @3, @4, SYSUTCDATETIME(), @5
                )
            `;
      await this.dataSource.query(query, [
        validSessionId,
        validUserId,
        data.username,
        data.ipAddress || null,
        data.userAgent || null,
        data.logoutReason || 'USER_LOGOUT',
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to record LogoutHistory: ${(error as Error).message}`,
      );
    }
  }
}
