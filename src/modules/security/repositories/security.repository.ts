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
                    FROM [auth].[LoginSessions]
                    WHERE IsActive = 1
                    AND RevokedAt IS NULL
                ) AS ActiveSessions,

                (
                    SELECT COUNT(*)
                    FROM [auth].[Users]
                    WHERE LockedUntil IS NOT NULL
                    AND LockedUntil > SYSUTCDATETIME()
                ) AS LockedUsers,

                (
                    SELECT COUNT(*)
                    FROM [auth].[FailedLoginAttempts]
                    WHERE AttemptedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS FailedLogins24Hours,

                (
                    SELECT COUNT(*)
                    FROM [auth].[LoginHistory]
                    WHERE LoginResult = 'SUCCESS'
                    AND LoginAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS SuccessfulLogins24Hours,

                (
                    SELECT COUNT(*)
                    FROM [auth].[SecurityEvents]
                    WHERE CreatedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS SecurityEvents24Hours,

                (
                    SELECT COUNT(*)
                    FROM [auth].[RateLimitEvents]
                    WHERE CreatedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS RateLimitEvents24Hours,

                (
                    SELECT COUNT(DISTINCT UserID)
                    FROM [auth].[LoginHistory]
                    WHERE LoginResult = 'SUCCESS'
                    AND LoginAt >= DATEADD(DAY, -1, SYSUTCDATETIME())
                ) AS ActiveUsersToday,

                (
                    SELECT COUNT(*)
                    FROM [auth].[LoginSessions]
                    WHERE RevokedAt IS NOT NULL
                    AND RevokedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
                ) AS RevokedSessions24Hours,

                (
                    SELECT COUNT(*)
                    FROM [auth].[SecurityEvents]
                    WHERE EventType = 'REFRESH_TOKEN_REPLAY'
                    AND CreatedAt >= DATEADD(HOUR, -24, SYSUTCDATETIME())
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
                    FROM [auth].[LoginSessions]
                    WHERE UserID = @0
                    AND IsActive = 1
                    AND RevokedAt IS NULL
                ) AS ActiveSessions,

                (
                    SELECT COUNT(*)
                    FROM [auth].[FailedLoginAttempts]
                    WHERE UserID = @0
                    AND AttemptedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
                ) AS FailedLoginsLast30Days,

                (
                    SELECT COUNT(*)
                    FROM [auth].[LoginHistory]
                    WHERE UserID = @0
                    AND LoginResult = 'SUCCESS'
                    AND LoginAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
                ) AS SuccessfulLoginsLast30Days,

                (
                    SELECT COUNT(*)
                    FROM [auth].[SecurityEvents]
                    WHERE UserID = @0
                    AND CreatedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
                ) AS SecurityEventsLast30Days,

                (
                    SELECT TOP 1 LoginAt
                    FROM [auth].[LoginHistory]
                    WHERE UserID = @0
                    AND LoginResult = 'SUCCESS'
                    ORDER BY LoginAt DESC
                ) AS LastLoginAt,

                (
                    SELECT TOP 1 LogoutAt
                    FROM [auth].[LogoutHistory]
                    WHERE UserID = @0
                    ORDER BY LogoutAt DESC
                ) AS LastLogoutAt,

                u.LockedUntil,

                CASE
                    WHEN u.LockedUntil IS NOT NULL
                     AND u.LockedUntil > SYSUTCDATETIME()
                    THEN CAST(1 AS BIT)
                    ELSE CAST(0 AS BIT)
                END AS AccountLocked

            FROM [auth].[Users] u
            WHERE u.UserID = @0
        `;

    const result = await this.dataSource.query(query, [userId]);
    const row = result[0] || {};

    return {
      activeSessions: Number(row.ActiveSessions ?? 0),
      failedLoginsLast30Days: Number(row.FailedLoginsLast30Days ?? 0),
      successfulLoginsLast30Days: Number(row.SuccessfulLoginsLast30Days ?? 0),
      securityEventsLast30Days: Number(row.SecurityEventsLast30Days ?? 0),
      lastLoginAt: row.LastLoginAt
        ? new Date(row.LastLoginAt).toISOString()
        : null,
      lastLogoutAt: row.LastLogoutAt
        ? new Date(row.LastLogoutAt).toISOString()
        : null,
      accountLocked: Boolean(row.AccountLocked),
      lockedUntil: row.LockedUntil
        ? new Date(row.LockedUntil).toISOString()
        : null,
    };
  }

  async getActiveSessionsDashboard(): Promise<ActiveSessionDto[]> {
    const query = `
            SELECT
                ls.LoginSessionID,
                ls.UserID,
                u.Username,
                ls.IPAddress,
                ls.DeviceInfo,
                ls.BrowserName,
                ls.DeviceType,
                ls.LastActivityAt,
                ls.LoginAt,
                ls.ExpiresAt,
                ls.IsActive
            FROM [auth].[LoginSessions] ls
            INNER JOIN [auth].[Users] u
                ON u.UserID = ls.UserID
            WHERE ls.IsActive = 1
            AND ls.RevokedAt IS NULL
            ORDER BY ls.LoginAt DESC
        `;

    const result = await this.dataSource.query(query);
    return result.map((row: any) => ({
      loginSessionId: row.LoginSessionID,
      LoginSessionID: row.LoginSessionID,
      userId: row.UserID,
      UserID: row.UserID,
      username: row.Username,
      Username: row.Username,
      ipAddress: row.IPAddress,
      IPAddress: row.IPAddress,
      deviceInfo: row.DeviceInfo || null,
      DeviceInfo: row.DeviceInfo || null,
      browserName: row.BrowserName || null,
      BrowserName: row.BrowserName || null,
      deviceType: row.DeviceType || null,
      DeviceType: row.DeviceType || null,
      lastActivityAt: row.LastActivityAt
        ? new Date(row.LastActivityAt).toISOString()
        : null,
      LastActivityAt: row.LastActivityAt
        ? new Date(row.LastActivityAt).toISOString()
        : null,
      loginAt: new Date(row.LoginAt).toISOString(),
      LoginAt: new Date(row.LoginAt).toISOString(),
      expiresAt: new Date(row.ExpiresAt).toISOString(),
      ExpiresAt: new Date(row.ExpiresAt).toISOString(),
      isActive: Boolean(row.IsActive ?? 1),
      IsActive: Boolean(row.IsActive ?? 1),
    }));
  }

  async getSecurityEvents(
    query: BaseQueryDto,
  ): Promise<PaginatedResult<SecurityEventDto>> {
    const allowedColumns = {
      securityEventId: 'SecurityEventID',
      userId: 'UserID',
      loginSessionId: 'LoginSessionID',
      eventType: 'EventType',
      eventDescription: 'EventDescription',
      ipAddress: 'IPAddress',
      userAgent: 'UserAgent',
      createdAt: 'CreatedAt',
    };

    const sortColumn = sanitizeSortColumn(
      query.sortBy,
      Object.values(allowedColumns),
      'CreatedAt',
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
      const searchClause = `(EventType LIKE @${searchParamIndex} OR EventDescription LIKE @${searchParamIndex} OR IPAddress LIKE @${searchParamIndex})`;
      allParams.push(`%${query.search}%`);
      finalWhere = finalWhere
        ? `${finalWhere} AND ${searchClause}`
        : `WHERE ${searchClause}`;
    }

    const countQuery = `
            SELECT COUNT(*) AS Total
            FROM [auth].[SecurityEvents]
            ${finalWhere}
        `;

    const countResult = await this.dataSource.query(countQuery, allParams);
    const total = Number(countResult[0]?.Total || 0);

    const dataParams = [...allParams, query.offset, query.pageSize];
    const offsetIndex = allParams.length;
    const limitIndex = allParams.length + 1;

    const dataQuery = `
            SELECT
                SecurityEventID,
                UserID,
                LoginSessionID,
                EventType,
                EventDescription,
                IPAddress,
                UserAgent,
                CreatedAt
            FROM [auth].[SecurityEvents]
            ${finalWhere}
            ORDER BY ${sortColumn} ${sortOrder}
            OFFSET @${offsetIndex} ROWS
            FETCH NEXT @${limitIndex} ROWS ONLY
        `;

    const rows = await this.dataSource.query(dataQuery, dataParams);
    const items: SecurityEventDto[] = rows.map((row: any) => ({
      securityEventId: row.SecurityEventID,
      SecurityEventID: row.SecurityEventID,
      userId: row.UserID,
      UserID: row.UserID,
      loginSessionId: row.LoginSessionID,
      LoginSessionID: row.LoginSessionID,
      eventType: row.EventType,
      EventType: row.EventType,
      eventDescription: row.EventDescription,
      EventDescription: row.EventDescription,
      ipAddress: row.IPAddress,
      IPAddress: row.IPAddress,
      userAgent: row.UserAgent,
      UserAgent: row.UserAgent,
      createdAt: new Date(row.CreatedAt).toISOString(),
      CreatedAt: new Date(row.CreatedAt).toISOString(),
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
      failedLoginAttemptId: 'FailedLoginAttemptID',
      userId: 'UserID',
      username: 'Username',
      ipAddress: 'IPAddress',
      failureReason: 'FailureReason',
      attemptedAt: 'AttemptedAt',
      browserName: 'BrowserName',
      deviceType: 'DeviceType',
    };

    const sortColumn = sanitizeSortColumn(
      query.sortBy,
      Object.values(allowedColumns),
      'AttemptedAt',
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
      const searchClause = `(Username LIKE @${searchParamIndex} OR IPAddress LIKE @${searchParamIndex} OR FailureReason LIKE @${searchParamIndex})`;
      allParams.push(`%${query.search}%`);
      finalWhere = finalWhere
        ? `${finalWhere} AND ${searchClause}`
        : `WHERE ${searchClause}`;
    }

    const countQuery = `
            SELECT COUNT(*) AS Total
            FROM [auth].[FailedLoginAttempts]
            ${finalWhere}
        `;

    const countResult = await this.dataSource.query(countQuery, allParams);
    const total = Number(countResult[0]?.Total || 0);

    const dataParams = [...allParams, query.offset, query.pageSize];
    const offsetIndex = allParams.length;
    const limitIndex = allParams.length + 1;

    const dataQuery = `
            SELECT
                FailedLoginAttemptID,
                UserID,
                Username,
                IPAddress,
                FailureReason,
                AttemptedAt,
                BrowserName,
                DeviceType
            FROM [auth].[FailedLoginAttempts]
            ${finalWhere}
            ORDER BY ${sortColumn} ${sortOrder}
            OFFSET @${offsetIndex} ROWS
            FETCH NEXT @${limitIndex} ROWS ONLY
        `;

    const rows = await this.dataSource.query(dataQuery, dataParams);
    const items: FailedLoginAttemptDto[] = rows.map((row: any) => ({
      failedLoginAttemptId: row.FailedLoginAttemptID,
      FailedLoginAttemptID: row.FailedLoginAttemptID,
      userId: row.UserID,
      UserID: row.UserID,
      username: row.Username,
      Username: row.Username,
      ipAddress: row.IPAddress,
      IPAddress: row.IPAddress,
      failureReason: row.FailureReason,
      FailureReason: row.FailureReason,
      attemptedAt: new Date(row.AttemptedAt).toISOString(),
      AttemptedAt: new Date(row.AttemptedAt).toISOString(),
      browserName: row.BrowserName,
      BrowserName: row.BrowserName,
      deviceType: row.DeviceType,
      DeviceType: row.DeviceType,
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
            FROM [auth].[FailedLoginAttempts]
            WHERE AttemptedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
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
            FROM [auth].[SecurityEvents]
            GROUP BY EventType
            ORDER BY Total DESC
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      eventType: row.EventType,
      count: Number(row.Total),
    }));
  }

  async sessionsByDeviceChartData(): Promise<SessionsByDeviceDto[]> {
    const query = `
            SELECT
                DeviceInfo,
                COUNT(*) AS Total
            FROM [auth].[LoginSessions]
            WHERE IsActive = 1
            AND RevokedAt IS NULL
            GROUP BY DeviceInfo
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      device: row.DeviceInfo || 'Unknown',
      count: Number(row.Total),
    }));
  }

  async sessionsByRoleChartData(): Promise<SessionsByRoleDto[]> {
    const query = `
            SELECT
                r.RoleCode,
                COUNT(DISTINCT ls.LoginSessionID) AS Total
            FROM [auth].[LoginSessions] ls
            INNER JOIN [auth].[UserRoles] ur
                ON ur.UserID = ls.UserID
            INNER JOIN [auth].[Roles] r
                ON r.RoleID = ur.RoleID
            WHERE ls.IsActive = 1
            AND ls.RevokedAt IS NULL
            GROUP BY r.RoleCode
            ORDER BY Total DESC
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      role: row.RoleCode,
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
            FROM [auth].[LoginHistory]
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
            FROM [auth].[SecurityEvents]
            WHERE EventType = 'REFRESH_TOKEN_REPLAY'
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
            FROM [auth].[Users]
            WHERE LockedUntil > SYSUTCDATETIME()
            ORDER BY FailedLoginCount DESC
        `;

    const rows = await this.dataSource.query(query);
    return rows.map((row: any) => ({
      username: row.Username,
      lockouts: Number(row.FailedLoginCount),
    }));
  }

  async sessionsCreatedPerDayChartData(): Promise<SessionsCreatedPerDayDto[]> {
    const query = `
            SELECT
                CAST(LoginAt AS DATE) AS [Date],
                COUNT(*) AS Total
            FROM [auth].[LoginSessions]
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
