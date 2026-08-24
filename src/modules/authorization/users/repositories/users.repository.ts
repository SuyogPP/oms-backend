import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IUser,
  IUserWithProfile,
  ICreateUserData,
  IUpdateUserData,
  IUserFilterOptions,
  IUserListResult,
} from '../interfaces/users.interface';
import { MAX_FAILED_LOGIN_ATTEMPTS, ACCOUNT_LOCKOUT_MINUTES } from '../users.constants';

@Injectable()
export class UsersRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Finds an active (non-deleted) user by unique UserID.
   */
  async findById(userId: string, qr?: QueryRunner): Promise<IUserWithProfile | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          u.UserID AS userId,
          u.EmployeeID AS employeeId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.IsActive AS isActive,
          u.IsDeleted AS isDeleted,
          u.DeletedAt AS deletedAt,
          u.DeletedBy AS deletedBy,
          u.FailedLoginCount AS failedLoginCount,
          u.LastFailedLoginAt AS lastFailedLoginAt,
          u.LockedUntil AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt,
          p.UserProfileID AS userProfileId,
          p.FirstName AS firstName,
          p.LastName AS lastName,
          p.DisplayName AS displayName,
          p.PhoneNumber AS phoneNumber,
          p.JobTitle AS jobTitle,
          p.OrganizationID AS organizationId,
          p.BusinessUnitID AS businessUnitId,
          p.DepartmentID AS departmentId,
          p.SectionID AS sectionId,
          p.VendorID AS vendorId,
          p.MustChangePassword AS mustChangePassword,
          p.PasswordChangedAt AS passwordChangedAt
      FROM [auth].[Users] u
      LEFT JOIN [auth].[UserProfiles] p ON p.UserID = u.UserID
      WHERE u.UserID = @0 AND u.IsDeleted = 0;
      `,
      [userId],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.mapUserRow(rows[0]);
  }

  /**
   * Finds a user by unique UserID including soft-deleted accounts.
   */
  async findByIdIncludingDeleted(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IUserWithProfile | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          u.UserID AS userId,
          u.EmployeeID AS employeeId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.IsActive AS isActive,
          u.IsDeleted AS isDeleted,
          u.DeletedAt AS deletedAt,
          u.DeletedBy AS deletedBy,
          u.FailedLoginCount AS failedLoginCount,
          u.LastFailedLoginAt AS lastFailedLoginAt,
          u.LockedUntil AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt,
          p.UserProfileID AS userProfileId,
          p.FirstName AS firstName,
          p.LastName AS lastName,
          p.DisplayName AS displayName,
          p.PhoneNumber AS phoneNumber,
          p.JobTitle AS jobTitle,
          p.OrganizationID AS organizationId,
          p.BusinessUnitID AS businessUnitId,
          p.DepartmentID AS departmentId,
          p.SectionID AS sectionId,
          p.VendorID AS vendorId,
          p.MustChangePassword AS mustChangePassword,
          p.PasswordChangedAt AS passwordChangedAt
      FROM [auth].[Users] u
      LEFT JOIN [auth].[UserProfiles] p ON p.UserID = u.UserID
      WHERE u.UserID = @0;
      `,
      [userId],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.mapUserRow(rows[0]);
  }

  /**
   * Finds a user by email address across ALL users (including deleted for U1 uniqueness validation).
   */
  async findByEmail(email: string, qr?: QueryRunner): Promise<IUser | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          u.UserID AS userId,
          u.EmployeeID AS employeeId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.IsActive AS isActive,
          u.IsDeleted AS isDeleted,
          u.DeletedAt AS deletedAt,
          u.DeletedBy AS deletedBy,
          u.FailedLoginCount AS failedLoginCount,
          u.LastFailedLoginAt AS lastFailedLoginAt,
          u.LockedUntil AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt
      FROM [auth].[Users] u
      WHERE LOWER(u.Email) = LOWER(@0);
      `,
      [email],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return rows[0];
  }

  /**
   * Finds a user by username across ALL users (for U2 uniqueness validation).
   */
  async findByUsername(username: string, qr?: QueryRunner): Promise<IUser | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          u.UserID AS userId,
          u.EmployeeID AS employeeId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.IsActive AS isActive,
          u.IsDeleted AS isDeleted,
          u.DeletedAt AS deletedAt,
          u.DeletedBy AS deletedBy,
          u.FailedLoginCount AS failedLoginCount,
          u.LastFailedLoginAt AS lastFailedLoginAt,
          u.LockedUntil AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt
      FROM [auth].[Users] u
      WHERE LOWER(u.Username) = LOWER(@0);
      `,
      [username],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return rows[0];
  }

  /**
   * Paginated and scope-filtered user query (§9.2).
   */
  async findAll(
    options: IUserFilterOptions,
    qr?: QueryRunner,
  ): Promise<IUserListResult> {
    const {
      search,
      userType,
      status,
      departmentId,
      businessUnitId,
      organizationId,
      vendorId,
      isLocked,
      requesterUserId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = options;

    const offset = (page - 1) * limit;
    const params: any[] = [];
    let paramIndex = 0;

    let whereClause = `WHERE u.IsDeleted = 0`;

    // Scope filtering (§9.2) via requester user ID and org.fn_VisibleOrgUnits
    if (requesterUserId) {
      whereClause += `
        AND (
            EXISTS (
                SELECT 1 FROM [auth].[UserOrganizationScopes] s
                INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
                WHERE s.UserID = @${paramIndex}
                  AND sd.ScopeCode = 'GLOBAL'
                  AND (s.IsActive = 1 OR s.IsActive IS NULL)
            )
            OR EXISTS (
                SELECT 1 FROM [org].[fn_VisibleOrgUnits](@${paramIndex}) v
                WHERE (p.DepartmentID IS NOT NULL AND v.OrgUnitId = p.DepartmentID)
                   OR (p.BusinessUnitID IS NOT NULL AND v.OrgUnitId = p.BusinessUnitID)
                   OR (p.SectionID IS NOT NULL AND v.OrgUnitId = p.SectionID)
            )
            OR u.UserID = @${paramIndex}
        )
      `;
      params.push(requesterUserId);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (
        LOWER(u.Username) LIKE LOWER(@${paramIndex}) OR 
        LOWER(u.Email) LIKE LOWER(@${paramIndex}) OR 
        LOWER(p.FirstName) LIKE LOWER(@${paramIndex}) OR 
        LOWER(p.LastName) LIKE LOWER(@${paramIndex})
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (userType) {
      whereClause += ` AND u.UserType = @${paramIndex}`;
      params.push(userType);
      paramIndex++;
    }

    if (departmentId) {
      whereClause += ` AND p.DepartmentID = @${paramIndex}`;
      params.push(departmentId);
      paramIndex++;
    }

    if (businessUnitId) {
      whereClause += ` AND p.BusinessUnitID = @${paramIndex}`;
      params.push(businessUnitId);
      paramIndex++;
    }

    if (organizationId) {
      whereClause += ` AND p.OrganizationID = @${paramIndex}`;
      params.push(organizationId);
      paramIndex++;
    }

    if (vendorId) {
      whereClause += ` AND p.VendorID = @${paramIndex}`;
      params.push(vendorId);
      paramIndex++;
    }

    if (options.hasNoRole) {
      whereClause += ` AND NOT EXISTS (
        SELECT 1 FROM [auth].[UserRoles] ur
        WHERE ur.UserID = u.UserID
          AND ur.IsActive = 1
          AND (ur.EffectiveFrom IS NULL OR ur.EffectiveFrom <= SYSUTCDATETIME())
          AND (ur.EffectiveTo IS NULL OR ur.EffectiveTo > SYSUTCDATETIME())
      )`;
    }

    if (options.role) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM [auth].[UserRoles] ur
        INNER JOIN [auth].[Roles] r ON r.RoleID = ur.RoleID
        WHERE ur.UserID = u.UserID
          AND ur.IsActive = 1
          AND (ur.EffectiveFrom IS NULL OR ur.EffectiveFrom <= SYSUTCDATETIME())
          AND (ur.EffectiveTo IS NULL OR ur.EffectiveTo > SYSUTCDATETIME())
          AND (LOWER(r.RoleCode) = LOWER(@${paramIndex}) OR CAST(r.RoleID AS NVARCHAR(50)) = @${paramIndex})
      )`;
      params.push(options.role);
      paramIndex++;
    }

    if (isLocked !== undefined) {
      if (isLocked) {
        whereClause += ` AND u.LockedUntil IS NOT NULL AND u.LockedUntil > SYSUTCDATETIME()`;
      } else {
        whereClause += ` AND (u.LockedUntil IS NULL OR u.LockedUntil <= SYSUTCDATETIME())`;
      }
    }

    if (status) {
      if (status === 'LOCKED') {
        whereClause += ` AND u.LockedUntil IS NOT NULL AND u.LockedUntil > SYSUTCDATETIME()`;
      } else if (status === 'ACTIVE') {
        whereClause += ` AND u.IsActive = 1 AND (u.LockedUntil IS NULL OR u.LockedUntil <= SYSUTCDATETIME())`;
      } else if (status === 'INACTIVE') {
        whereClause += ` AND u.IsActive = 0 AND EXISTS (SELECT 1 FROM [auth].[LocalCredentials] lc WHERE lc.UserID = u.UserID)`;
      } else if (status === 'INVITED') {
        whereClause += ` AND u.IsActive = 0 AND NOT EXISTS (SELECT 1 FROM [auth].[LocalCredentials] lc WHERE lc.UserID = u.UserID)`;
      }
    }

    // Safe sort column mapping
    const sortColumnMap: Record<string, string> = {
      createdAt: 'u.CreatedAt',
      username: 'u.Username',
      email: 'u.Email',
      firstName: 'p.FirstName',
      lastName: 'p.LastName',
    };
    const orderCol = sortColumnMap[sortBy] || 'u.CreatedAt';
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countSql = `
      SELECT COUNT(1) AS total
      FROM [auth].[Users] u
      LEFT JOIN [auth].[UserProfiles] p ON p.UserID = u.UserID
      ${whereClause};
    `;

    const countResult = await this.getExecutor(qr).query(countSql, params);
    const total = countResult[0]?.total ? Number(countResult[0].total) : 0;

    const dataSql = `
      SELECT 
          u.UserID AS userId,
          u.EmployeeID AS employeeId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.IsActive AS isActive,
          u.IsDeleted AS isDeleted,
          u.DeletedAt AS deletedAt,
          u.DeletedBy AS deletedBy,
          u.FailedLoginCount AS failedLoginCount,
          u.LastFailedLoginAt AS lastFailedLoginAt,
          u.LockedUntil AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt,
          p.UserProfileID AS userProfileId,
          p.FirstName AS firstName,
          p.LastName AS lastName,
          p.DisplayName AS displayName,
          p.PhoneNumber AS phoneNumber,
          p.JobTitle AS jobTitle,
          p.OrganizationID AS organizationId,
          p.BusinessUnitID AS businessUnitId,
          p.DepartmentID AS departmentId,
          p.SectionID AS sectionId,
          p.VendorID AS vendorId,
          p.MustChangePassword AS mustChangePassword,
          p.PasswordChangedAt AS passwordChangedAt
      FROM [auth].[Users] u
      LEFT JOIN [auth].[UserProfiles] p ON p.UserID = u.UserID
      ${whereClause}
      ORDER BY ${orderCol} ${orderDirection}
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY;
    `;

    const rows = await this.getExecutor(qr).query(dataSql, params);
    const items = rows.map((r: any) => this.mapUserRow(r));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves users for CSV/JSON export (up to 10,000 records).
   */
  async exportUsers(
    options: IUserFilterOptions,
    qr?: QueryRunner,
  ): Promise<IUserWithProfile[]> {
    const result = await this.findAll({ ...options, page: 1, limit: 10000 }, qr);
    return result.items;
  }

  /**
   * Revokes all active sessions for a user in auth.LoginSessions.
   */
  async revokeAllUserSessions(
    userId: string,
    reason: string = 'User status change',
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[LoginSessions]
      SET IsActive = 0, RevokedAt = SYSUTCDATETIME(), RevokeReason = @1
      WHERE UserID = @0 AND IsActive = 1 AND RevokedAt IS NULL;
      `,
      [userId, reason],
    );
  }

  /**
   * Queries user activity and security events for a specific user.
   */
  async getUserActivity(
    userId: string,
    limit: number = 50,
    qr?: QueryRunner,
  ): Promise<any[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP (@1)
          se.SecurityEventID AS eventId,
          se.UserID AS userId,
          se.EventType AS eventType,
          se.EventDescription AS description,
          se.IPAddress AS ipAddress,
          se.UserAgent AS userAgent,
          se.CreatedAt AS createdAt
      FROM [auth].[SecurityEvents] se
      WHERE se.UserID = @0
      ORDER BY se.CreatedAt DESC;
      `,
      [userId, limit],
    );

    return rows.map((r: any) => ({
      eventId: r.eventId,
      userId: r.userId,
      eventType: r.eventType,
      description: r.description,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: new Date(r.createdAt),
    }));
  }

  /**
   * Creates a new user row in auth.Users.
   */
  async create(data: ICreateUserData, qr?: QueryRunner): Promise<string> {
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].[Users] (
          UserID,
          EmployeeID,
          Username,
          Email,
          UserType,
          IsActive,
          IsDeleted,
          FailedLoginCount,
          ADObjectID,
          CreatedAt,
          UpdatedAt
      )
      OUTPUT INSERTED.UserID AS userId
      VALUES (
          COALESCE(@0, NEWID()),
          @1,
          @2,
          @3,
          @4,
          @5,
          0,
          0,
          @6,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
      );
      `,
      [
        data.userId || null,
        data.employeeId || null,
        data.username,
        data.email,
        data.userType,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : 0,
        data.adObjectId || null,
      ],
    );

    return rows[0].userId;
  }

  /**
   * Updates an existing user row in auth.Users.
   */
  async update(
    userId: string,
    data: IUpdateUserData,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Users]
      SET 
          EmployeeID = COALESCE(@1, EmployeeID),
          Username = COALESCE(@2, Username),
          Email = COALESCE(@3, Email),
          UserType = COALESCE(@4, UserType),
          UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0 AND IsDeleted = 0;
      `,
      [
        userId,
        data.employeeId !== undefined ? data.employeeId : null,
        data.username || null,
        data.email || null,
        data.userType || null,
      ],
    );
  }

  /**
   * Activates a user account.
   */
  async activate(userId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Users]
      SET IsActive = 1, UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0 AND IsDeleted = 0;
      `,
      [userId],
    );
  }

  /**
   * Deactivates a user account.
   */
  async deactivate(userId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Users]
      SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0 AND IsDeleted = 0;
      `,
      [userId],
    );
  }

  /**
   * Performs soft deletion of a user per U13.
   */
  async softDelete(
    userId: string,
    deletedBy?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Users]
      SET 
          IsDeleted = 1,
          IsActive = 0,
          DeletedAt = SYSUTCDATETIME(),
          DeletedBy = @1,
          UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0 AND IsDeleted = 0;
      `,
      [userId, deletedBy || null],
    );
  }

  /**
   * Unlocks a locked user account (clears failed attempts, last failed login, and lockout window).
   */
  async unlock(userId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Users]
      SET 
          FailedLoginCount = 0,
          LastFailedLoginAt = NULL,
          LockedUntil = NULL,
          UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0;
      `,
      [userId],
    );
  }

  /**
   * Records a failed login attempt, applying automatic lockout if threshold is exceeded.
   */
  async recordFailedLogin(
    userId: string,
    maxAttempts: number = MAX_FAILED_LOGIN_ATTEMPTS,
    lockoutMinutes: number = ACCOUNT_LOCKOUT_MINUTES,
    qr?: QueryRunner,
  ): Promise<{ failedCount: number; isLocked: boolean }> {
    const rows = await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Users]
      SET 
          FailedLoginCount = FailedLoginCount + 1,
          LastFailedLoginAt = SYSUTCDATETIME(),
          LockedUntil = CASE 
              WHEN FailedLoginCount + 1 >= @1 THEN DATEADD(MINUTE, @2, SYSUTCDATETIME())
              ELSE LockedUntil 
          END,
          UpdatedAt = SYSUTCDATETIME()
      OUTPUT 
          INSERTED.FailedLoginCount AS failedCount,
          CASE WHEN INSERTED.LockedUntil > SYSUTCDATETIME() THEN 1 ELSE 0 END AS isLocked
      WHERE UserID = @0;
      `,
      [userId, maxAttempts, lockoutMinutes],
    );

    return {
      failedCount: rows[0]?.failedCount ? Number(rows[0].failedCount) : 1,
      isLocked: rows[0]?.isLocked === 1 || rows[0]?.isLocked === true,
    };
  }

  /**
   * Resets failed login counters upon successful authentication.
   */
  async resetFailedLoginCount(userId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Users]
      SET FailedLoginCount = 0, LastFailedLoginAt = NULL, LockedUntil = NULL, UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0;
      `,
      [userId],
    );
  }

  /**
   * Upserts local password credentials for a user in auth.LocalCredentials.
   */
  async upsertLocalCredentials(
    userId: string,
    passwordHash: string,
    mustChangePassword: boolean = false,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      IF EXISTS (SELECT 1 FROM [auth].[LocalCredentials] WHERE UserID = @0)
      BEGIN
          UPDATE [auth].[LocalCredentials]
          SET PasswordHash = @1,
              PasswordChangedAt = SYSUTCDATETIME(),
              MustChangePassword = @2,
              IsActive = 1
          WHERE UserID = @0;
      END
      ELSE
      BEGIN
          INSERT INTO [auth].[LocalCredentials] (
              CredentialID,
              UserID,
              PasswordHash,
              PasswordChangedAt,
              MustChangePassword,
              IsActive,
              CreatedAt
          )
          VALUES (
              NEWID(),
              @0,
              @1,
              SYSUTCDATETIME(),
              @2,
              1,
              SYSUTCDATETIME()
          );
      END
      `,
      [userId, passwordHash, mustChangePassword ? 1 : 0],
    );
  }

  /**
   * Sets the MustChangePassword flag across LocalCredentials and UserProfiles.
   */
  async setMustChangePassword(
    userId: string,
    mustChange: boolean = true,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[LocalCredentials]
      SET MustChangePassword = @1
      WHERE UserID = @0;

      UPDATE [auth].[UserProfiles]
      SET MustChangePassword = @1, UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0;
      `,
      [userId, mustChange ? 1 : 0],
    );
  }

  /**
   * Records LogoutHistory entries for all active sessions of a user before session revocation.
   */
  async recordLogoutHistoryForSessions(
    userId: string,
    reason: string = 'PASSWORD_RESET',
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].[LogoutHistory] (
          LoginSessionID,
          UserID,
          Username,
          IPAddress,
          UserAgent,
          LogoutAt,
          LogoutReason
      )
      SELECT 
          ls.LoginSessionID,
          ls.UserID,
          COALESCE(u.Username, 'UNKNOWN'),
          ls.IPAddress,
          ls.UserAgent,
          SYSUTCDATETIME(),
          @1
      FROM [auth].[LoginSessions] ls
      INNER JOIN [auth].[Users] u ON u.UserID = ls.UserID
      WHERE ls.UserID = @0 AND ls.IsActive = 1;
      `,
      [userId, reason],
    );
  }

  /**
   * Counts active SYSTEM_ADMIN users (U15 guard against deleting the last admin).
   */
  async countActiveSystemAdmins(qr?: QueryRunner): Promise<number> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT COUNT(DISTINCT u.UserID) AS adminCount
      FROM [auth].[Users] u
      INNER JOIN [auth].[UserRoles] ur ON ur.UserID = u.UserID
      INNER JOIN [auth].[Roles] r ON r.RoleID = ur.RoleID
      WHERE r.RoleCode = 'SYSTEM_ADMIN'
        AND u.IsActive = 1
        AND u.IsDeleted = 0
        AND ur.IsActive = 1
        AND ur.EffectiveFrom <= SYSUTCDATETIME()
        AND (ur.EffectiveTo IS NULL OR ur.EffectiveTo > SYSUTCDATETIME());
      `,
    );

    return rows[0]?.adminCount ? Number(rows[0].adminCount) : 0;
  }

  /**
   * Checks if user is currently assigned as primary head of any org unit (U16 guard).
   */
  async isUserPrimaryHeadOfAnyOrgUnit(
    userId: string,
    qr?: QueryRunner,
  ): Promise<boolean> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP 1 1 AS isHead
      FROM [org].[OrgManagers] om
      WHERE om.UserID = @0
        AND om.IsPrimary = 1
        AND om.IsActive = 1
        AND om.EffectiveFrom <= SYSUTCDATETIME()
        AND (om.EffectiveTo IS NULL OR om.EffectiveTo > SYSUTCDATETIME());
      `,
      [userId],
    );

    return rows && rows.length > 0;
  }

  private mapUserRow(r: any): IUserWithProfile {
    let status: 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'LOCKED' = 'ACTIVE';
    if (r.lockedUntil && new Date(r.lockedUntil) > new Date()) {
      status = 'LOCKED';
    } else if (!r.isActive) {
      status = 'INACTIVE';
    }

    return {
      userId: r.userId,
      employeeId: r.employeeId,
      username: r.username,
      email: r.email,
      userType: r.userType,
      isActive: r.isActive === 1 || r.isActive === true,
      isDeleted: r.isDeleted === 1 || r.isDeleted === true,
      deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
      deletedBy: r.deletedBy,
      failedLoginCount: Number(r.failedLoginCount || 0),
      lastFailedLoginAt: r.lastFailedLoginAt ? new Date(r.lastFailedLoginAt) : null,
      lockedUntil: r.lockedUntil ? new Date(r.lockedUntil) : null,
      adObjectId: r.adObjectId,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      status,
      profile: r.userProfileId
        ? {
            userProfileId: r.userProfileId,
            userId: r.userId,
            firstName: r.firstName,
            lastName: r.lastName,
            displayName: r.displayName,
            phoneNumber: r.phoneNumber,
            jobTitle: r.jobTitle,
            organizationId: r.organizationId,
            businessUnitId: r.businessUnitId,
            departmentId: r.departmentId,
            sectionId: r.sectionId,
            vendorId: r.vendorId,
            mustChangePassword:
              r.mustChangePassword === 1 || r.mustChangePassword === true,
            passwordChangedAt: r.passwordChangedAt
              ? new Date(r.passwordChangedAt)
              : null,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
          }
        : null,
    };
  }
}
