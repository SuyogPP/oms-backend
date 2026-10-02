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
import {
  MAX_FAILED_LOGIN_ATTEMPTS,
  ACCOUNT_LOCKOUT_MINUTES,
} from '../users.constants';

@Injectable()
export class UsersRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Finds an active (non-deleted) user by unique UserID.
   */
  async findById(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IUserWithProfile | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          u.user_id AS userId,
          u.employee_id AS employeeId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.is_active AS isActive,
          u.failed_login_count AS failedLoginCount,
          u.locked_until AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          u.first_name AS firstName,
          u.last_name AS lastName,
          RTRIM(LTRIM(u.first_name + ' ' + ISNULL(u.last_name, ''))) AS displayName,
          u.mobile_no AS phoneNumber,
          u.job_title AS jobTitle,
          u.org_unit_id AS orgUnitId, u.vendor_id AS vendorId,
          ISNULL(lc.must_change_password, 0) AS mustChangePassword,
          lc.password_changed_at AS passwordChangedAt,
          (
            SELECT STRING_AGG(r.role_code, ',')
            FROM [auth].tbl_User_Roles] ur
            INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id
            WHERE ur.user_id = u.user_id
              AND ur.is_active = 1
              AND (ur.effective_from IS NULL OR ur.effective_from <= SYSUTCDATETIME())
              AND (ur.effective_to IS NULL OR ur.effective_to > SYSUTCDATETIME())
          ) AS roles
      FROM [auth].tbl_Users] u
      LEFT JOIN [auth].tbl_Local_Credentials] lc ON lc.user_id = u.user_id
      WHERE u.user_id = @0 ;
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
          u.user_id AS userId,
          u.employee_id AS employeeId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.is_active AS isActive,
          u.failed_login_count AS failedLoginCount,
          u.locked_until AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          u.first_name AS firstName,
          u.last_name AS lastName,
          RTRIM(LTRIM(u.first_name + ' ' + ISNULL(u.last_name, ''))) AS displayName,
          u.mobile_no AS phoneNumber,
          u.job_title AS jobTitle,
          u.org_unit_id AS orgUnitId, u.vendor_id AS vendorId,
          ISNULL(lc.must_change_password, 0) AS mustChangePassword,
          lc.password_changed_at AS passwordChangedAt,
          (
            SELECT STRING_AGG(r.role_code, ',')
            FROM [auth].tbl_User_Roles] ur
            INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id
            WHERE ur.user_id = u.user_id
              AND ur.is_active = 1
              AND (ur.effective_from IS NULL OR ur.effective_from <= SYSUTCDATETIME())
              AND (ur.effective_to IS NULL OR ur.effective_to > SYSUTCDATETIME())
          ) AS roles
      FROM [auth].tbl_Users] u
      LEFT JOIN [auth].tbl_Local_Credentials] lc ON lc.user_id = u.user_id
      WHERE u.user_id = @0;
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
          u.user_id AS userId,
          u.employee_id AS employeeId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.is_active AS isActive,
          u.failed_login_count AS failedLoginCount,
          u.locked_until AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt
      FROM [auth].tbl_Users] u
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
  async findByUsername(
    username: string,
    qr?: QueryRunner,
  ): Promise<IUser | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          u.user_id AS userId,
          u.employee_id AS employeeId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.is_active AS isActive,
          u.failed_login_count AS failedLoginCount,
          u.locked_until AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt
      FROM [auth].tbl_Users] u
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
      limit: rawLimit,
      pageSize,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = options;

    const limit = pageSize ?? rawLimit ?? 20;
    const offset = (page - 1) * limit;
    const params: any[] = [];
    let paramIndex = 0;

    let whereClause = `WHERE 1=1`;

    // Scope filtering (§9.2) via requester user ID and org.fn_VisibleOrgUnits
    if (requesterUserId) {
      whereClause += `
        AND (
            EXISTS (
                SELECT 1 FROM [auth].[UserOrganizationScopes] s
                INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
                WHERE s.user_id = @${paramIndex}
                  AND sd.ScopeCode = 'GLOBAL'
                  AND (s.is_active = 1 OR s.is_active IS NULL)
            )
            OR EXISTS (
                SELECT 1 FROM [org].[fn_VisibleOrgUnits](@${paramIndex}) v
                WHERE (u.org_unit_id IS NOT NULL AND v.OrgUnitId = u.org_unit_id)
                   OR (u.org_unit_id IS NOT NULL AND v.OrgUnitId = u.org_unit_id)
                   OR (u.org_unit_id IS NOT NULL AND v.OrgUnitId = u.org_unit_id)
            )
            OR u.user_id = @${paramIndex}
        )
      `;
      params.push(requesterUserId);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (
        LOWER(u.Username) LIKE LOWER(@${paramIndex}) OR 
        LOWER(u.Email) LIKE LOWER(@${paramIndex}) OR 
        LOWER(u.first_name) LIKE LOWER(@${paramIndex}) OR 
        LOWER(u.last_name) LIKE LOWER(@${paramIndex})
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
      whereClause += ` AND u.org_unit_id = @${paramIndex}`;
      params.push(departmentId);
      paramIndex++;
    }

    if (businessUnitId) {
      whereClause += ` AND u.org_unit_id = @${paramIndex}`;
      params.push(businessUnitId);
      paramIndex++;
    }

    if (organizationId) {
      whereClause += ` AND (u.org_unit_id = @${paramIndex} OR u.org_unit_id = @${paramIndex})`;
      params.push(organizationId);
      paramIndex++;
    }

    if (vendorId) {
      whereClause += ` AND u.UserType = 'VENDOR'`;
    }

    if (options.hasNoRole) {
      whereClause += ` AND NOT EXISTS (
        SELECT 1 FROM [auth].tbl_User_Roles] ur
        WHERE ur.user_id = u.user_id
          AND ur.is_active = 1
          AND (ur.effective_from IS NULL OR ur.effective_from <= SYSUTCDATETIME())
          AND (ur.effective_to IS NULL OR ur.effective_to > SYSUTCDATETIME())
      )`;
    }

    if (options.role) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM [auth].tbl_User_Roles] ur
        INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id
        WHERE ur.user_id = u.user_id
          AND ur.is_active = 1
          AND (ur.effective_from IS NULL OR ur.effective_from <= SYSUTCDATETIME())
          AND (ur.effective_to IS NULL OR ur.effective_to > SYSUTCDATETIME())
          AND (LOWER(r.role_code) = LOWER(@${paramIndex}) OR CAST(r.role_id AS NVARCHAR(50)) = @${paramIndex})
      )`;
      params.push(options.role);
      paramIndex++;
    }

    if (isLocked !== undefined) {
      if (isLocked) {
        whereClause += ` AND u.locked_until IS NOT NULL AND u.locked_until > SYSUTCDATETIME()`;
      } else {
        whereClause += ` AND (u.locked_until IS NULL OR u.locked_until <= SYSUTCDATETIME())`;
      }
    }

    if (status) {
      if (status === 'LOCKED') {
        whereClause += ` AND u.locked_until IS NOT NULL AND u.locked_until > SYSUTCDATETIME()`;
      } else if (status === 'ACTIVE') {
        whereClause += ` AND u.is_active = 1 AND (u.locked_until IS NULL OR u.locked_until <= SYSUTCDATETIME())`;
      } else if (status === 'INACTIVE') {
        whereClause += ` AND u.is_active = 0 AND EXISTS (SELECT 1 FROM [auth].tbl_Local_Credentials] lc WHERE lc.user_id = u.user_id)`;
      } else if (status === 'INVITED') {
        whereClause += ` AND u.is_active = 0 AND NOT EXISTS (SELECT 1 FROM [auth].tbl_Local_Credentials] lc WHERE lc.user_id = u.user_id)`;
      }
    }

    // Safe sort column mapping
    const sortColumnMap: Record<string, string> = {
      createdAt: 'u.created_at',
      username: 'u.Username',
      email: 'u.Email',
      firstName: 'u.first_name',
      lastName: 'u.last_name',
    };
    const orderCol = sortColumnMap[sortBy] || 'u.created_at';
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countSql = `
      SELECT COUNT(1) AS total
      FROM [auth].tbl_Users] u
      ${whereClause};
    `;

    const countResult = await this.getExecutor(qr).query(countSql, params);
    const total = countResult[0]?.total ? Number(countResult[0].total) : 0;

    const dataSql = `
      WITH NumberedRows AS (
          SELECT 
              u.user_id AS userId,
              u.employee_id AS employeeId,
              u.Username AS username,
              u.Email AS email,
              u.UserType AS userType,
              u.is_active AS isActive,
              u.failed_login_count AS failedLoginCount,
              u.locked_until AS lockedUntil,
              u.ADObjectID AS adObjectId,
              u.created_at AS createdAt,
              u.updated_at AS updatedAt,
              u.first_name AS firstName,
              u.last_name AS lastName,
              RTRIM(LTRIM(u.first_name + ' ' + ISNULL(u.last_name, ''))) AS displayName,
              u.mobile_no AS phoneNumber,
              u.job_title AS jobTitle,
              u.org_unit_id AS orgUnitId, u.vendor_id AS vendorId,
              ISNULL(lc.must_change_password, 0) AS mustChangePassword,
              lc.password_changed_at AS passwordChangedAt,
              (
                SELECT STRING_AGG(r.role_code, ',')
                FROM [auth].tbl_User_Roles] ur
                INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id
                WHERE ur.user_id = u.user_id
                  AND ur.is_active = 1
                  AND (ur.effective_from IS NULL OR ur.effective_from <= SYSUTCDATETIME())
                  AND (ur.effective_to IS NULL OR ur.effective_to > SYSUTCDATETIME())
              ) AS roles,
              ROW_NUMBER() OVER (ORDER BY ${orderCol} ${orderDirection}) AS RowNum
          FROM [auth].tbl_Users] u
          LEFT JOIN [auth].tbl_Local_Credentials] lc ON lc.user_id = u.user_id
          ${whereClause}
      )
      SELECT 
          userId,
          employeeId,
          username,
          email,
          userType,
          isActive,
          isDeleted,
          deletedAt,
          deletedBy,
          failedLoginCount,
          lastFailedLoginAt,
          lockedUntil,
          adObjectId,
          createdAt,
          updatedAt,
          userProfileId,
          firstName,
          lastName,
          displayName,
          phoneNumber,
          jobTitle,
          orgUnitId,
          vendorId,
          mustChangePassword,
          passwordChangedAt,
          roles
      FROM NumberedRows
      WHERE RowNum > ${offset} AND RowNum <= (${offset} + ${limit})
      ORDER BY RowNum;
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
    const result = await this.findAll(
      { ...options, page: 1, limit: 10000 },
      qr,
    );
    return result.items;
  }

  /**
   * Revokes all active sessions for a user in auth.tbl_Login_Sessions.
   */
  async revokeAllUserSessions(
    userId: string,
    reason: string = 'User status change',
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].tbl_Login_Sessions]
      SET is_active = 0, RevokedAt = SYSUTCDATETIME(), RevokeReason = @1
      WHERE user_id = @0 AND is_active = 1 AND revoked_at IS NULL;
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
          se.security_event_id AS eventId,
          se.user_id AS userId,
          se.event_type AS eventType,
          se.event_description AS description,
          se.IPAddress AS ipAddress,
          se.user_agent AS userAgent,
          se.created_at AS createdAt
      FROM [auth].tbl_Security_Events] se
      WHERE se.user_id = @0
      ORDER BY se.created_at DESC;
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
   * Checks if user is head of any active organizational unit.
   */
  async isUserOrgHead(userId: string, qr?: QueryRunner): Promise<boolean> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP 1 1 AS isHead
      FROM [org].[OrgManagers] om
      WHERE om.user_id = @0
        AND om.is_primary = 1
        AND om.is_active = 1
        AND om.effective_from <= SYSUTCDATETIME()
        AND (om.effective_to IS NULL OR om.effective_to > SYSUTCDATETIME());
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

    const roles: string[] = r.roles
      ? typeof r.roles === 'string'
        ? r.roles
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : Array.isArray(r.roles)
          ? r.roles
          : []
      : [];

    return {
      userId: r.userId,
      employeeId: r.employeeId,
      username: r.username,
      email: r.email,
      userType: r.userType,
      isActive: r.isActive === 1 || r.isActive === true,
      failedLoginCount: Number(r.failedLoginCount || 0),
      lockedUntil: r.lockedUntil ? new Date(r.lockedUntil) : null,
      adObjectId: r.adObjectId,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      status,
      roles,
      firstName: r.firstName,
      lastName: r.lastName,
      displayName: r.displayName,
      mobileNo: r.phoneNumber,
      jobTitle: r.jobTitle,
      orgUnitId: r.orgUnitId,
      vendorId: r.vendorId,
    };
  }

  /**
   * Creates a new user row in auth.tbl_Users.
   */
  async create(data: ICreateUserData, qr?: QueryRunner): Promise<string> {
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].tbl_Users] (
          UserID,
          EmployeeID,
          Username,
          Email,
          UserType,
          IsActive,
          FailedLoginCount, ADObjectID, FirstName, LastName, MobileNo, JobTitle, OrgUnitID, VendorID, CreatedAt, UpdatedAt
      )
      OUTPUT INSERTED.user_id AS userId
      VALUES (
          COALESCE(@0, NEWID()),
          @1,
          @2,
          @3,
          @4,
          @5,
          0, @6, @7, @8, @9, @10, @11, @12, SYSUTCDATETIME(), SYSUTCDATETIME()
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
        data.firstName || null,
        data.lastName || null,
        data.mobileNo || null,
        data.jobTitle || null,
        data.orgUnitId || null,
        data.vendorId || null,
      ],
    );

    return rows[0].userId;
  }

  /**
   * Updates an existing user row in auth.tbl_Users.
   */
  async update(
    userId: string,
    data: IUpdateUserData,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].tbl_Users]
      SET 
          EmployeeID = COALESCE(@1, EmployeeID),
          Username = COALESCE(@2, Username),
          Email = COALESCE(@3, Email),
          UserType = COALESCE(@4, UserType),
          FirstName = COALESCE(@5, FirstName),
          LastName = COALESCE(@6, LastName),
          MobileNo = COALESCE(@7, MobileNo),
          JobTitle = COALESCE(@8, JobTitle),
          OrgUnitID = COALESCE(@9, OrgUnitID),
          VendorID = COALESCE(@10, VendorID),
          UpdatedAt = SYSUTCDATETIME()
      WHERE user_id = @0 ;
      `,
      [
        userId,
        data.employeeId !== undefined ? data.employeeId : null,
        data.username || null,
        data.email || null,
        data.userType || null,
        data.firstName || null,
        data.lastName || null,
        data.mobileNo || null,
        data.jobTitle || null,
        data.orgUnitId || null,
        data.vendorId || null,
      ],
    );
  }

  /**
   * Activates a user account.
   */
  async activate(userId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].tbl_Users]
      SET is_active = 1, UpdatedAt = SYSUTCDATETIME()
      WHERE user_id = @0 ;
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
      UPDATE [auth].tbl_Users]
      SET is_active = 0, UpdatedAt = SYSUTCDATETIME()
      WHERE user_id = @0 ;
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
      UPDATE [auth].tbl_Users]
      SET is_active = 0, UpdatedAt = SYSUTCDATETIME()
      WHERE user_id = @0 ;
      `,
      [userId],
    );
  }

  /**
   * Unlocks a locked user account (clears failed attempts, last failed login, and lockout window).
   */
  async unlock(userId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].tbl_Users]
      SET 
          FailedLoginCount = 0,
          LockedUntil = NULL,
          UpdatedAt = SYSUTCDATETIME()
      WHERE user_id = @0;
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
      UPDATE [auth].tbl_Users]
      SET 
          FailedLoginCount = FailedLoginCount + 1,
          LockedUntil = CASE 
              WHEN FailedLoginCount + 1 >= @1 THEN DATEADD(MINUTE, @2, SYSUTCDATETIME())
              ELSE LockedUntil 
          END,
          UpdatedAt = SYSUTCDATETIME()
      OUTPUT 
          INSERTED.failed_login_count AS failedCount,
          CASE WHEN INSERTED.locked_until > SYSUTCDATETIME() THEN 1 ELSE 0 END AS isLocked
      WHERE user_id = @0;
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
      UPDATE [auth].tbl_Users]
      SET failed_login_count = 0, LockedUntil = NULL, UpdatedAt = SYSUTCDATETIME()
      WHERE user_id = @0;
      `,
      [userId],
    );
  }

  /**
   * Upserts local password credentials for a user in auth.tbl_Local_Credentials.
   */
  async upsertLocalCredentials(
    userId: string,
    passwordHash: string,
    mustChangePassword: boolean = false,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      IF EXISTS (SELECT 1 FROM [auth].tbl_Local_Credentials] WHERE user_id = @0)
      BEGIN
          UPDATE [auth].tbl_Local_Credentials]
          SET password_hash = @1,
              PasswordChangedAt = SYSUTCDATETIME(),
              MustChangePassword = @2,
              IsActive = 1
          WHERE user_id = @0;
      END
      ELSE
      BEGIN
          INSERT INTO [auth].tbl_Local_Credentials] (
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
      UPDATE [auth].tbl_Local_Credentials]
      SET must_change_password = @1
      WHERE user_id = @0;
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
      INSERT INTO [auth].tbl_Logout_History] (
          LoginSessionID,
          UserID,
          Username,
          IPAddress,
          UserAgent,
          LogoutAt,
          LogoutReason
      )
      SELECT 
          ls.login_session_id,
          ls.user_id,
          COALESCE(u.Username, 'UNKNOWN'),
          ls.IPAddress,
          ls.user_agent,
          SYSUTCDATETIME(),
          @1
      FROM [auth].tbl_Login_Sessions] ls
      INNER JOIN [auth].tbl_Users] u ON u.user_id = ls.user_id
      WHERE ls.user_id = @0 AND ls.is_active = 1;
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
      SELECT COUNT(DISTINCT u.user_id) AS adminCount
      FROM [auth].tbl_Users] u
      INNER JOIN [auth].tbl_User_Roles] ur ON ur.user_id = u.user_id
      INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id
      WHERE r.role_code = 'SYSTEM_ADMIN'
        AND u.is_active = 1
        
        AND ur.is_active = 1
        AND ur.effective_from <= SYSUTCDATETIME()
        AND (ur.effective_to IS NULL OR ur.effective_to > SYSUTCDATETIME());
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
      WHERE om.user_id = @0
        AND om.is_primary = 1
        AND om.is_active = 1
        AND om.effective_from <= SYSUTCDATETIME()
        AND (om.effective_to IS NULL OR om.effective_to > SYSUTCDATETIME());
      `,
      [userId],
    );

    return rows && rows.length > 0;
  }
}
