import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  BaseQueryDto,
  PaginatedResult,
  sanitizeSortColumn,
  SortOrder,
} from '../../../common/dto/pagination.dto';
import { buildWhereClause } from '../../../common/utils/filter-query-builder.util';
import {
  ActiveSessionDto,
  FailedLoginAttemptDto,
  FailedLoginsChartDto,
  LockedAccountsDto,
  LoginTrendDto,
  ReplayEventsDto,
  SecurityDashboardSummaryDto,
  SecurityEventDto,
  SecurityEventsByTypeDto,
  SecuritySummaryDto,
  SessionsByDeviceDto,
  SessionsByRoleDto,
  SessionsCreatedPerDayDto,
} from '../dto/security-dashboard.dto';

@Injectable()
export class SecurityRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getDashboardSummary(): Promise<SecurityDashboardSummaryDto> {
    const query = `
            SELECT
                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Login_Sessions]
                    WHERE is_active = 1
                    AND revoked_at IS NULL
                ) AS ActiveSessions,

                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Users]
                    WHERE locked_until IS NOT NULL
                    AND locked_until > SYSUTCDATETIME()
                ) AS LockedUsers,

                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Failed_Login_Attempts]
                    WHERE attempted_at >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS FailedLogins24Hours,

                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Login_History]
                    WHERE login_result = 'SUCCESS'
                    AND login_at >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS SuccessfulLogins24Hours,

                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Security_Events]
                    WHERE created_at >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS SecurityEvents24Hours,

                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Rate_Limit_Events]
                    WHERE created_at >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS RateLimitEvents24Hours,

                (
                    SELECT COUNT(DISTINCT UserID)
                    FROM [auth].tbl_Login_History]
                    WHERE login_result = 'SUCCESS'
                    AND login_at >= DATEADD(DAY, -1, SYSUTCDATETIME())
                ) AS ActiveUsersToday,

                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Login_Sessions]
                    WHERE revoked_at IS NOT NULL
                    AND revoked_at >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS RevokedSessions24Hours,

                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Security_Events]
                    WHERE event_type = 'REFRESH_TOKEN_REPLAY'
                    AND created_at >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS RefreshTokenReplayEvents24Hours
        `;

    const result = await this.dataSource.query(query);
    const row = result[0] || {};

    return {
      activeSessions: Number(row.ActiveSessions ?? 0),
      lockedUsers: Number(row.LockedUsers ?? 0),
      failedLogins24Hours: Number(row.FailedLogins24Hours ?? 0),
      successfulLogins24Hours: Number(row.SuccessfulLogins24Hours ?? 0),
      securityEvents24Hours: Number(row.SecurityEvents24Hours ?? 0),
      rateLimitEvents24Hours: Number(row.RateLimitEvents24Hours ?? 0),
      activeUsersToday: Number(row.ActiveUsersToday ?? 0),
      revokedSessions24Hours: Number(row.RevokedSessions24Hours ?? 0),
      refreshTokenReplayEvents24Hours: Number(
        row.RefreshTokenReplayEvents24Hours ?? 0,
      ),
    };
  }

  async getSecuritySummaryById(userId: string): Promise<SecuritySummaryDto> {
    const query = `
            SELECT
                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Login_Sessions]
                    WHERE user_id = @0
                    AND is_active = 1
                    AND revoked_at IS NULL
                ) AS ActiveSessions,

                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Failed_Login_Attempts]
                    WHERE user_id = @0
                    AND attempted_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
                ) AS FailedLoginsLast30Days,

                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Login_History]
                    WHERE user_id = @0
                    AND login_result = 'SUCCESS'
                    AND login_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
                ) AS SuccessfulLoginsLast30Days,

                (
                    SELECT COUNT(*)
                    FROM [auth].tbl_Security_Events]
                    WHERE user_id = @0
                    AND created_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
                ) AS SecurityEventsLast30Days,

                (
                    SELECT TOP 1 LoginAt
                    FROM [auth].tbl_Login_History]
                    WHERE user_id = @0
                    AND login_result = 'SUCCESS'
                    ORDER BY login_at DESC
                ) AS last_login_at,

                (
                    SELECT TOP 1 LogoutAt
                    FROM [auth].tbl_Logout_History]
                    WHERE user_id = @0
                    ORDER BY logout_at DESC
                ) AS LastLogoutAt,

                u.locked_until,

                CASE
                    WHEN u.locked_until IS NOT NULL
                     AND u.locked_until > SYSUTCDATETIME()
                    THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END AS AccountLocked

            FROM [auth].tbl_Users] u
            WHERE u.user_id = @0
        `;

    const result = await this.dataSource.query(query, [userId]);
    const row = result[0] || {};

    return {
      activeSessions: Number(row.ActiveSessions ?? 0),
      failedLoginsLast30Days: Number(row.FailedLoginsLast30Days ?? 0),
      successfulLoginsLast30Days: Number(row.SuccessfulLoginsLast30Days ?? 0),
      securityEventsLast30Days: Number(row.SecurityEventsLast30Days ?? 0),
      lastLoginAt: row.last_login_at
        ? new Date(row.last_login_at).toISOString()
        : null,
      lastLogoutAt: row.LastLogoutAt
        ? new Date(row.LastLogoutAt).toISOString()
        : null,
      accountLocked: Boolean(row.AccountLocked),
      lockedUntil: row.locked_until
        ? new Date(row.locked_until).toISOString()
        : null,
    };
  }

  async getActiveSessionsDashboard(): Promise<ActiveSessionDto[]> {
    const query = `
            SELECT
                ls.login_session_id,
                ls.user_id,
                u.Username,
                ls.IPAddress,
                ls.device_info,
                ls.browser_name,
                ls.device_type,
                ls.last_activity_at,
                ls.login_at,
                ls.expires_at,
                ls.is_active
            FROM [auth].tbl_Login_Sessions] ls
            INNER JOIN [auth].tbl_Users] u
                ON u.user_id = ls.user_id
            WHERE ls.is_active = 1
            AND ls.revoked_at IS NULL
            ORDER BY ls.login_at DESC
        `;

    const result = await this.dataSource.query(query);
    return result.map((row: any) => ({
      loginSessionId: row.login_session_id,
      LoginSessionID: row.login_session_id,
      userId: row.user_id,
      UserID: row.user_id,
      username: row.Username,
      Username: row.Username,
      ipAddress: row.IPAddress,
      IPAddress: row.IPAddress,
      deviceInfo: row.device_info || null,
      DeviceInfo: row.device_info || null,
      browserName: row.browser_name || null,
      BrowserName: row.browser_name || null,
      deviceType: row.device_type || null,
      DeviceType: row.device_type || null,
      lastActivityAt: row.last_activity_at
        ? new Date(row.last_activity_at).toISOString()
        : null,
      LastActivityAt: row.last_activity_at
        ? new Date(row.last_activity_at).toISOString()
        : null,
      loginAt: new Date(row.login_at).toISOString(),
      LoginAt: new Date(row.login_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      ExpiresAt: new Date(row.expires_at).toISOString(),
      isActive: Boolean(row.is_active ?? 1),
      IsActive: Boolean(row.is_active ?? 1),
    }));
  }

  async getSecurityEvents(
    query: BaseQueryDto,
  ): Promise<PaginatedResult<SecurityEventDto>> {
    const allowedColumns = {
      securityEventId: 'security_event_id',
      userId: 'user_id',
      loginSessionId: 'login_session_id',
      eventType: 'event_type',
      eventDescription: 'event_description',
      ipAddress: 'IPAddress',
      userAgent: 'user_agent',
      createdAt: 'created_at',
    };

    const sortColumn = sanitizeSortColumn(
      query.sortBy,
      Object.values(allowedColumns),
      'created_at',
    );
    const sortOrder = query.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';

    const { whereClause, params } = buildWhereClause({
      filters: query.filters,
      allowedColumns,
      startIndex: 0,
    });

    // Add search condition if provided
    let finalWhere = whereClause;
    const allParams = [...params];

    if (query.search) {
      const searchParamIndex = allParams.length;
      const searchClause = `(EventType LIKE @${searchParamIndex} OR event_description LIKE @${searchParamIndex} OR IPAddress LIKE @${searchParamIndex})`;
      allParams.push(`%${query.search}%`);
      finalWhere = finalWhere
        ? `${finalWhere} AND ${searchClause}`
        : `WHERE ${searchClause}`;
    }

    const countQuery = `
            SELECT COUNT(*) AS Total
            FROM [auth].tbl_Security_Events]
            ${finalWhere}
        `;

    const countResult = await this.dataSource.query(countQuery, allParams);
    const total = Number(countResult[0]?.Total || 0);

    const dataParams = [...allParams, query.offset, query.pageSize];
    const offsetIndex = allParams.length;
    const limitIndex = allParams.length + 1;

    const dataQuery = `
            WITH NumberedRows AS (
                SELECT
                    SecurityEventID,
                    UserID,
                    LoginSessionID,
                    EventType,
                    EventDescription,
                    IPAddress,
                    UserAgent,
                    CreatedAt,
                    ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortOrder}) AS RowNum
                FROM [auth].tbl_Security_Events]
                ${finalWhere}
            )
            SELECT
                SecurityEventID,
                UserID,
                LoginSessionID,
                EventType,
                EventDescription,
                IPAddress,
                UserAgent,
                CreatedAt
            FROM NumberedRows
            WHERE RowNum > @${offsetIndex} AND RowNum <= (@${offsetIndex} + @${limitIndex})
            ORDER BY RowNum
        `;

    const rows = await this.dataSource.query(dataQuery, dataParams);
    const items: SecurityEventDto[] = rows.map((row: any) => ({
      securityEventId: row.security_event_id,
      SecurityEventID: row.security_event_id,
      userId: row.user_id,
      UserID: row.user_id,
      loginSessionId: row.login_session_id,
      LoginSessionID: row.login_session_id,
      eventType: row.event_type,
      EventType: row.event_type,
      eventDescription: row.event_description,
      EventDescription: row.event_description,
      ipAddress: row.IPAddress,
      IPAddress: row.IPAddress,
      userAgent: row.user_agent,
      UserAgent: row.user_agent,
      createdAt: new Date(row.created_at).toISOString(),
      CreatedAt: new Date(row.created_at).toISOString(),
    }));

    return new PaginatedResult<SecurityEventDto>(
      items,
      total,
      query.page,
      query.pageSize,
    );
  }

  async getFailedLoginAttempts(
    query: BaseQueryDto,
  ): Promise<PaginatedResult<FailedLoginAttemptDto>> {
    const allowedColumns = {
      failedLoginAttemptId: 'failed_login_attempt_id',
      userId: 'user_id',
      username: 'Username',
      ipAddress: 'IPAddress',
      failureReason: 'failure_reason',
      attemptedAt: 'attempted_at',
      browserName: 'browser_name',
      deviceType: 'device_type',
    };

    const sortColumn = sanitizeSortColumn(
      query.sortBy,
      Object.values(allowedColumns),
      'attempted_at',
    );
    const sortOrder = query.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';

    const { whereClause, params } = buildWhereClause({
      filters: query.filters,
      allowedColumns,
      startIndex: 0,
    });

    let finalWhere = whereClause;
    const allParams = [...params];

    if (query.search) {
      const searchParamIndex = allParams.length;
      const searchClause = `(Username LIKE @${searchParamIndex} OR IPAddress LIKE @${searchParamIndex} OR failure_reason LIKE @${searchParamIndex})`;
      allParams.push(`%${query.search}%`);
      finalWhere = finalWhere
        ? `${finalWhere} AND ${searchClause}`
        : `WHERE ${searchClause}`;
    }

    const countQuery = `
            SELECT COUNT(*) AS Total
            FROM [auth].tbl_Failed_Login_Attempts]
            ${finalWhere}
        `;

    const countResult = await this.dataSource.query(countQuery, allParams);
    const total = Number(countResult[0]?.Total || 0);

    const dataParams = [...allParams, query.offset, query.pageSize];
    const offsetIndex = allParams.length;
    const limitIndex = allParams.length + 1;

    const dataQuery = `
            WITH NumberedRows AS (
                SELECT
                    FailedLoginAttemptID,
                    UserID,
                    Username,
                    IPAddress,
                    FailureReason,
                    AttemptedAt,
                    BrowserName,
                    DeviceType,
                    ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortOrder}) AS RowNum
                FROM [auth].tbl_Failed_Login_Attempts]
                ${finalWhere}
            )
            SELECT
                FailedLoginAttemptID,
                UserID,
                Username,
                IPAddress,
                FailureReason,
                AttemptedAt,
                BrowserName,
                DeviceType
            FROM NumberedRows
            WHERE RowNum > @${offsetIndex} AND RowNum <= (@${offsetIndex} + @${limitIndex})
            ORDER BY RowNum
        `;

    const rows = await this.dataSource.query(dataQuery, dataParams);
    const items: FailedLoginAttemptDto[] = rows.map((row: any) => ({
      failedLoginAttemptId: row.failed_login_attempt_id,
      FailedLoginAttemptID: row.failed_login_attempt_id,
      userId: row.user_id,
      UserID: row.user_id,
      username: row.Username,
      Username: row.Username,
      ipAddress: row.IPAddress,
      IPAddress: row.IPAddress,
      failureReason: row.failure_reason,
      FailureReason: row.failure_reason,
      attemptedAt: new Date(row.attempted_at).toISOString(),
      AttemptedAt: new Date(row.attempted_at).toISOString(),
      browserName: row.browser_name,
      BrowserName: row.browser_name,
      deviceType: row.device_type,
      DeviceType: row.device_type,
    }));

    return new PaginatedResult<FailedLoginAttemptDto>(
      items,
      total,
      query.page,
      query.pageSize,
    );
  }

  async failedLoginChartData(): Promise<FailedLoginsChartDto[]> {
    const query = `
            SELECT
                CAST(AttemptedAt AS DATE) AS [Date],
                COUNT(*) AS Total
            FROM [auth].tbl_Failed_Login_Attempts]
            WHERE attempted_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
            GROUP BY CAST(AttemptedAt AS DATE)
            ORDER BY [Date]
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      date:
        row.Date instanceof Date
          ? row.Date.toISOString().split('T')[0]
          : String(row.Date),
      count: Number(row.Total),
    }));
  }

  async securityEventsByTypeChartData(): Promise<SecurityEventsByTypeDto[]> {
    const query = `
            SELECT
                EventType,
                COUNT(*) AS Total
            FROM [auth].tbl_Security_Events]
            GROUP BY event_type
            ORDER BY Total DESC
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      eventType: row.event_type,
      count: Number(row.Total),
    }));
  }

  async sessionsByDeviceChartData(): Promise<SessionsByDeviceDto[]> {
    const query = `
            SELECT
                DeviceInfo,
                COUNT(*) AS Total
            FROM [auth].tbl_Login_Sessions]
            WHERE is_active = 1
            AND revoked_at IS NULL
            GROUP BY device_info
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      device: row.device_info || 'Unknown',
      count: Number(row.Total),
    }));
  }

  async sessionsByRoleChartData(): Promise<SessionsByRoleDto[]> {
    const query = `
            SELECT
                r.role_code,
                COUNT(DISTINCT ls.login_session_id) AS Total
            FROM [auth].tbl_Login_Sessions] ls
            INNER JOIN [auth].tbl_User_Roles] ur
                ON ur.user_id = ls.user_id
            INNER JOIN [auth].tbl_Roles] r
                ON r.role_id = ur.role_id
            WHERE ls.is_active = 1
            AND ls.revoked_at IS NULL
            GROUP BY r.role_code
            ORDER BY Total DESC
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      role: row.role_code,
      count: Number(row.Total),
    }));
  }

  async loginTrendChartData(): Promise<LoginTrendDto[]> {
    const query = `
            SELECT
                CAST(LoginAt AS DATE) AS [Date],
                SUM(
                    CASE
                        WHEN LoginResult = 'SUCCESS'
                        THEN 1
                        ELSE 0
                    END
                ) AS Successes,
                SUM(
                    CASE
                        WHEN LoginResult <> 'SUCCESS'
                        THEN 1
                        ELSE 0
                    END
                ) AS Failures
            FROM [auth].tbl_Login_History]
            GROUP BY CAST(LoginAt AS DATE)
            ORDER BY [Date]
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      date:
        row.Date instanceof Date
          ? row.Date.toISOString().split('T')[0]
          : String(row.Date),
      success: Number(row.Successes),
      failure: Number(row.Failures),
    }));
  }

  async replayEventsChartData(): Promise<ReplayEventsDto[]> {
    const query = `
            SELECT
                CAST(CreatedAt AS DATE) AS [Date],
                COUNT(*) AS Total
            FROM [auth].tbl_Security_Events]
            WHERE event_type = 'REFRESH_TOKEN_REPLAY'
            GROUP BY CAST(CreatedAt AS DATE)
            ORDER BY [Date]
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      date:
        row.Date instanceof Date
          ? row.Date.toISOString().split('T')[0]
          : String(row.Date),
      count: Number(row.Total),
    }));
  }

  async lockedAccountsChartData(): Promise<LockedAccountsDto[]> {
    const query = `
            SELECT
                Username,
                FailedLoginCount
            FROM [auth].tbl_Users]
            WHERE locked_until > SYSUTCDATETIME()
            ORDER BY failed_login_count DESC
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      username: row.Username,
      lockouts: Number(row.failed_login_count),
    }));
  }

  async sessionsCreatedPerDayChartData(): Promise<SessionsCreatedPerDayDto[]> {
    const query = `
            SELECT
                CAST(LoginAt AS DATE) AS [Date],
                COUNT(*) AS Total
            FROM [auth].tbl_Login_Sessions]
            GROUP BY CAST(LoginAt AS DATE)
            ORDER BY [Date]
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      date:
        row.Date instanceof Date
          ? row.Date.toISOString().split('T')[0]
          : String(row.Date),
      count: Number(row.Total),
    }));
  }
}
