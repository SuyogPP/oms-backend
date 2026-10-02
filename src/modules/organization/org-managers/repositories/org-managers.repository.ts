import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IOrgUnitManager } from '../interfaces/org-manager.interface';
import { ORG_MANAGER_ROLES } from '../org-managers.constants';

@Injectable()
export class OrgManagersRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Retrieves all manager assignment records for an organization unit.
   */
  async findByUnitId(
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager[]> {
    const sql = `
      SELECT
        m.OrgUnitManagerId AS orgUnitManagerId,
        m.OrgUnitId AS orgUnitId,
        m.UserId AS userId,
        m.manager_role_code AS managerRoleCode,
        m.is_primary AS isPrimary,
        m.effective_from AS effectiveFrom,
        m.effective_to AS effectiveTo,
        m.AssignmentReason AS assignmentReason,
        m.is_active AS isActive,
        m.IsDeleted AS isDeleted,
        m.created_by AS createdBy,
        m.created_at AS createdAt,
        m.updated_by AS updatedBy,
        m.updated_at AS updatedAt,
        u.Username AS username,
        u.Email AS userEmail,
        CONCAT(p.first_name, ' ', p.last_name) AS userDisplayName,
        ou.Name AS orgUnitName,
        ou.Code AS orgUnitCode
      FROM org.OrgUnitManagers m
      INNER JOIN auth.tbl_Users u ON u.user_id = m.UserId
      LEFT JOIN auth.UserProfiles p ON p.user_id = u.user_id
      INNER JOIN org.OrgUnits ou ON ou.OrgUnitId = m.OrgUnitId
      WHERE m.OrgUnitId = @0 AND m.IsDeleted = 0
      ORDER BY m.effective_from DESC, m.is_primary DESC, m.created_at DESC;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId]);
    if (rows.length > 0) {
      return rows;
    }

    // Fallback: Check if an active user has role 'HOD' / 'SECTION_HEAD' scoped to this orgUnitId or is ou.HeadUserId
    const fallbackSql = `
      SELECT TOP 1
        CAST(NULL AS UNIQUEIDENTIFIER) AS orgUnitManagerId,
        ou.OrgUnitId AS orgUnitId,
        u.user_id AS userId,
        'HEAD' AS managerRoleCode,
        CAST(1 AS BIT) AS isPrimary,
        ou.effective_from AS effectiveFrom,
        ou.effective_to AS effectiveTo,
        'Auto-resolved from assigned Head of Department' AS assignmentReason,
        CAST(1 AS BIT) AS isActive,
        CAST(0 AS BIT) AS isDeleted,
        ou.created_by AS createdBy,
        ou.created_at AS createdAt,
        ou.updated_by AS updatedBy,
        ou.updated_at AS updatedAt,
        u.Username AS username,
        u.Email AS userEmail,
        CASE
          WHEN p.first_name IS NOT NULL OR p.last_name IS NOT NULL THEN
            LTRIM(RTRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))))
          ELSE u.Username
        END AS userDisplayName,
        ou.Name AS orgUnitName,
        ou.Code AS orgUnitCode
      FROM org.OrgUnits ou
      INNER JOIN auth.tbl_Users u ON (
        u.user_id = ou.HeadUserId
        OR u.user_id IN (
          SELECT s.user_id
          FROM auth.UserOrganizationScopes s
          INNER JOIN auth.tbl_User_Roles ur ON ur.user_id = s.user_id
          INNER JOIN auth.tbl_Roles r ON r.role_id = ur.role_id
          WHERE (s.DepartmentID = ou.OrgUnitId OR s.BusinessUnitID = ou.OrgUnitId OR s.SectionID = ou.OrgUnitId OR s.OrganizationID = ou.OrgUnitId)
            AND r.role_code IN ('HOD', 'SECTION_HEAD')
        )
      )
      LEFT JOIN auth.UserProfiles p ON p.user_id = u.user_id
      WHERE ou.OrgUnitId = @0 AND u.IsDeleted = 0 AND u.is_active = 1;
    `;
    return this.getExecutor(qr).query(fallbackSql, [orgUnitId]);
  }

  /**
   * Finds current active primary HEAD manager for an organization unit as of a given date (default today).
   * Per Rule G7, queries OrgUnitManagers directly with effective-date filtering.
   */
  async findCurrentHead(
    orgUnitId: string,
    asOfDate?: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager | null> {
    const dateParam = asOfDate || new Date().toISOString().split('T')[0];

    const sql = `
      SELECT TOP 1
        m.OrgUnitManagerId AS orgUnitManagerId,
        m.OrgUnitId AS orgUnitId,
        m.UserId AS userId,
        m.manager_role_code AS managerRoleCode,
        m.is_primary AS isPrimary,
        m.effective_from AS effectiveFrom,
        m.effective_to AS effectiveTo,
        m.AssignmentReason AS assignmentReason,
        m.is_active AS isActive,
        m.IsDeleted AS isDeleted,
        m.created_by AS createdBy,
        m.created_at AS createdAt,
        m.updated_by AS updatedBy,
        m.updated_at AS updatedAt,
        u.Username AS username,
        u.Email AS userEmail,
        CONCAT(p.first_name, ' ', p.last_name) AS userDisplayName,
        ou.Name AS orgUnitName,
        ou.Code AS orgUnitCode
      FROM org.OrgUnitManagers m
      INNER JOIN auth.tbl_Users u ON u.user_id = m.UserId
      LEFT JOIN auth.UserProfiles p ON p.user_id = u.user_id
      INNER JOIN org.OrgUnits ou ON ou.OrgUnitId = m.OrgUnitId
      WHERE m.OrgUnitId = @0
        AND m.manager_role_code = '${ORG_MANAGER_ROLES.HEAD}'
        AND m.is_primary = 1
        AND m.is_active = 1
        AND m.IsDeleted = 0
        AND m.effective_from <= CAST(@1 AS DATE)
        AND (m.effective_to IS NULL OR m.effective_to >= CAST(@1 AS DATE))
      ORDER BY m.effective_from DESC;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId, dateParam]);
    if (rows.length > 0) {
      return rows[0];
    }

    // Fallback: Check if an active user has role 'HOD' / 'SECTION_HEAD' scoped to this orgUnitId or is ou.HeadUserId
    const fallbackSql = `
      SELECT TOP 1
        CAST(NULL AS UNIQUEIDENTIFIER) AS orgUnitManagerId,
        ou.OrgUnitId AS orgUnitId,
        u.user_id AS userId,
        'HEAD' AS managerRoleCode,
        CAST(1 AS BIT) AS isPrimary,
        ou.effective_from AS effectiveFrom,
        ou.effective_to AS effectiveTo,
        'Auto-resolved from assigned Head of Department' AS assignmentReason,
        CAST(1 AS BIT) AS isActive,
        CAST(0 AS BIT) AS isDeleted,
        ou.created_by AS createdBy,
        ou.created_at AS createdAt,
        ou.updated_by AS updatedBy,
        ou.updated_at AS updatedAt,
        u.Username AS username,
        u.Email AS userEmail,
        CASE
          WHEN p.first_name IS NOT NULL OR p.last_name IS NOT NULL THEN
            LTRIM(RTRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))))
          ELSE u.Username
        END AS userDisplayName,
        ou.Name AS orgUnitName,
        ou.Code AS orgUnitCode
      FROM org.OrgUnits ou
      INNER JOIN auth.tbl_Users u ON (
        u.user_id = ou.HeadUserId
        OR u.user_id IN (
          SELECT s.user_id
          FROM auth.UserOrganizationScopes s
          INNER JOIN auth.tbl_User_Roles ur ON ur.user_id = s.user_id
          INNER JOIN auth.tbl_Roles r ON r.role_id = ur.role_id
          WHERE (s.DepartmentID = ou.OrgUnitId OR s.BusinessUnitID = ou.OrgUnitId OR s.SectionID = ou.OrgUnitId OR s.OrganizationID = ou.OrgUnitId)
            AND r.role_code IN ('HOD', 'SECTION_HEAD')
        )
      )
      LEFT JOIN auth.UserProfiles p ON p.user_id = u.user_id
      WHERE ou.OrgUnitId = @0 AND u.IsDeleted = 0 AND u.is_active = 1;
    `;
    const fallbackRows = await this.getExecutor(qr).query(fallbackSql, [orgUnitId]);
    return fallbackRows.length > 0 ? fallbackRows[0] : null;
  }

  /**
   * Retrieves a manager assignment by its ID.
   */
  async findById(
    orgUnitManagerId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager | null> {
    const sql = `
      SELECT
        m.OrgUnitManagerId AS orgUnitManagerId,
        m.OrgUnitId AS orgUnitId,
        m.UserId AS userId,
        m.manager_role_code AS managerRoleCode,
        m.is_primary AS isPrimary,
        m.effective_from AS effectiveFrom,
        m.effective_to AS effectiveTo,
        m.AssignmentReason AS assignmentReason,
        m.is_active AS isActive,
        m.IsDeleted AS isDeleted,
        m.created_by AS createdBy,
        m.created_at AS createdAt,
        m.updated_by AS updatedBy,
        m.updated_at AS updatedAt,
        u.Username AS username,
        u.Email AS userEmail,
        CONCAT(p.first_name, ' ', p.last_name) AS userDisplayName,
        ou.Name AS orgUnitName,
        ou.Code AS orgUnitCode
      FROM org.OrgUnitManagers m
      INNER JOIN auth.tbl_Users u ON u.user_id = m.UserId
      LEFT JOIN auth.UserProfiles p ON p.user_id = u.user_id
      INNER JOIN org.OrgUnits ou ON ou.OrgUnitId = m.OrgUnitId
      WHERE m.OrgUnitManagerId = @0 AND m.IsDeleted = 0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitManagerId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Retrieves all units managed by a specific user.
   */
  async findByUserId(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager[]> {
    const sql = `
      SELECT
        m.OrgUnitManagerId AS orgUnitManagerId,
        m.OrgUnitId AS orgUnitId,
        m.UserId AS userId,
        m.manager_role_code AS managerRoleCode,
        m.is_primary AS isPrimary,
        m.effective_from AS effectiveFrom,
        m.effective_to AS effectiveTo,
        m.AssignmentReason AS assignmentReason,
        m.is_active AS isActive,
        m.IsDeleted AS isDeleted,
        m.created_by AS createdBy,
        m.created_at AS createdAt,
        m.updated_by AS updatedBy,
        m.updated_at AS updatedAt,
        u.Username AS username,
        u.Email AS userEmail,
        CONCAT(p.first_name, ' ', p.last_name) AS userDisplayName,
        ou.Name AS orgUnitName,
        ou.Code AS orgUnitCode
      FROM org.OrgUnitManagers m
      INNER JOIN auth.tbl_Users u ON u.user_id = m.UserId
      LEFT JOIN auth.UserProfiles p ON p.user_id = u.user_id
      INNER JOIN org.OrgUnits ou ON ou.OrgUnitId = m.OrgUnitId
      WHERE m.UserId = @0 AND m.IsDeleted = 0 AND ou.IsDeleted = 0
      ORDER BY m.effective_from DESC, m.is_active DESC;
    `;
    return this.getExecutor(qr).query(sql, [userId]);
  }

  /**
   * Inserts a new manager assignment record.
   */
  async create(
    data: {
      orgUnitId: string;
      userId: string;
      managerRoleCode: string;
      isPrimary: boolean;
      effectiveFrom: string;
      effectiveTo?: string | null;
      assignmentReason?: string | null;
    },
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager> {
    const sql = `
      INSERT INTO org.OrgUnitManagers (
        OrgUnitId,
        UserId,
        ManagerRoleCode,
        IsPrimary,
        EffectiveFrom,
        EffectiveTo,
        AssignmentReason,
        IsActive,
        IsDeleted,
        CreatedBy,
        CreatedAt
      )
      OUTPUT
        INSERTED.OrgUnitManagerId AS orgUnitManagerId,
        INSERTED.OrgUnitId AS orgUnitId,
        INSERTED.UserId AS userId,
        INSERTED.manager_role_code AS managerRoleCode,
        INSERTED.is_primary AS isPrimary,
        INSERTED.effective_from AS effectiveFrom,
        INSERTED.effective_to AS effectiveTo,
        INSERTED.AssignmentReason AS assignmentReason,
        INSERTED.is_active AS isActive,
        INSERTED.IsDeleted AS isDeleted,
        INSERTED.created_by AS createdBy,
        INSERTED.created_at AS createdAt,
        INSERTED.updated_by AS updatedBy,
        INSERTED.updated_at AS updatedAt
      VALUES (
        @0, @1, @2, @3, @4, @5, @6, 1, 0, @7, SYSUTCDATETIME()
      );
    `;

    const params = [
      data.orgUnitId,
      data.userId,
      data.managerRoleCode,
      data.isPrimary ? 1 : 0,
      data.effectiveFrom,
      data.effectiveTo ?? null,
      data.assignmentReason ?? null,
      actorUserId,
    ];

    const rows = await this.getExecutor(qr).query(sql, params);
    return rows[0];
  }

  /**
   * Updates an existing manager assignment record.
   */
  async update(
    orgUnitManagerId: string,
    data: {
      isPrimary?: boolean;
      effectiveTo?: string | null;
      assignmentReason?: string | null;
    },
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager> {
    const sql = `
      UPDATE org.OrgUnitManagers
      SET
        IsPrimary = CASE WHEN @1 IS NOT NULL THEN @1 ELSE IsPrimary END,
        EffectiveTo = CASE WHEN @2 IS NOT NULL THEN @2 ELSE EffectiveTo END,
        AssignmentReason = CASE WHEN @3 IS NOT NULL THEN @3 ELSE AssignmentReason END,
        UpdatedBy = @4,
        UpdatedAt = SYSUTCDATETIME()
      OUTPUT
        INSERTED.OrgUnitManagerId AS orgUnitManagerId,
        INSERTED.OrgUnitId AS orgUnitId,
        INSERTED.UserId AS userId,
        INSERTED.manager_role_code AS managerRoleCode,
        INSERTED.is_primary AS isPrimary,
        INSERTED.effective_from AS effectiveFrom,
        INSERTED.effective_to AS effectiveTo,
        INSERTED.AssignmentReason AS assignmentReason,
        INSERTED.is_active AS isActive,
        INSERTED.IsDeleted AS isDeleted,
        INSERTED.created_by AS createdBy,
        INSERTED.created_at AS createdAt,
        INSERTED.updated_by AS updatedBy,
        INSERTED.updated_at AS updatedAt
      WHERE OrgUnitManagerId = @0 AND IsDeleted = 0;
    `;

    const params = [
      orgUnitManagerId,
      data.isPrimary !== undefined ? (data.isPrimary ? 1 : 0) : null,
      data.effectiveTo !== undefined ? data.effectiveTo : null,
      data.assignmentReason !== undefined ? data.assignmentReason : null,
      actorUserId,
    ];

    const rows = await this.getExecutor(qr).query(sql, params);
    return rows[0];
  }

  /**
   * §7.4 Rule G2: Auto-ends the previous primary HEAD by setting its EffectiveTo
   * to (newEffectiveFrom - 1 day). Executed in the same transaction.
   */
  async endPreviousPrimaryHead(
    orgUnitId: string,
    newEffectiveFrom: string,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE org.OrgUnitManagers
      SET
        EffectiveTo = DATEADD(DAY, -1, CAST(@1 AS DATE)),
        UpdatedBy = @2,
        UpdatedAt = SYSUTCDATETIME()
      WHERE OrgUnitId = @0
        AND manager_role_code = '${ORG_MANAGER_ROLES.HEAD}'
        AND is_primary = 1
        AND IsDeleted = 0
        AND is_active = 1
        AND (EffectiveTo IS NULL OR effective_to >= CAST(@1 AS DATE));
    `;
    await this.getExecutor(qr).query(sql, [
      orgUnitId,
      newEffectiveFrom,
      actorUserId,
    ]);
  }

  /**
   * Soft deletes a manager assignment.
   */
  async softDelete(
    orgUnitManagerId: string,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE org.OrgUnitManagers
      SET
        IsDeleted = 1,
        IsActive = 0,
        DeletedBy = @1,
        DeletedAt = SYSUTCDATETIME()
      WHERE OrgUnitManagerId = @0;
    `;
    await this.getExecutor(qr).query(sql, [orgUnitManagerId, actorUserId]);
  }

  /**
   * §8.4 / Rule G7: Hierarchical approval chain resolution.
   * Walks ancestors from node to root using closure table, joining current active primary HEAD
   * manager at each level with effective-date filtering.
   *
   * NOTE: Domain 5 (Requisition & Approval Workflow) strictly depends on this method
   * and query contract. Do not change without cross-domain coordination.
   */
  async getApprovalChain(
    orgUnitId: string,
    asOfDate?: string,
    qr?: QueryRunner,
  ): Promise<any[]> {
    const dateParam = asOfDate || new Date().toISOString().split('T')[0];

    const sql = `
      SELECT
        c.Depth AS distance,
        u.OrgUnitId AS orgUnitId,
        u.Code AS orgUnitCode,
        u.Name AS orgUnitName,
        u.Depth AS orgUnitDepth,
        m.UserId AS headUserId,
        usr.Username AS headUsername,
        CONCAT(p.first_name, ' ', p.last_name) AS headDisplayName,
        usr.Email AS headEmail,
        m.manager_role_code AS managerRoleCode
      FROM org.OrgUnitClosure c
      INNER JOIN org.OrgUnits u ON u.OrgUnitId = c.AncestorOrgUnitId
      LEFT JOIN org.OrgUnitManagers m
             ON m.OrgUnitId = u.OrgUnitId
            AND m.manager_role_code = '${ORG_MANAGER_ROLES.HEAD}'
            AND m.is_primary = 1
            AND m.is_active = 1
            AND m.IsDeleted = 0
            AND m.effective_from <= @1
            AND (m.effective_to IS NULL OR m.effective_to >= @1)
      LEFT JOIN auth.tbl_Users usr ON usr.user_id = m.UserId
      LEFT JOIN auth.UserProfiles p ON p.user_id = usr.user_id
      WHERE c.DescendantOrgUnitId = @0
        AND u.IsDeleted = 0
      ORDER BY c.Depth ASC; -- Step 1 is self, step 2 is parent, up to root
    `;

    const rows = await this.getExecutor(qr).query(sql, [orgUnitId, dateParam]);

    return rows.map((r: any, idx: number) => ({
      step: idx + 1,
      distance: r.distance,
      orgUnitId: r.orgUnitId,
      orgUnitCode: r.orgUnitCode,
      orgUnitName: r.orgUnitName,
      orgUnitDepth: r.orgUnitDepth,
      head: r.headUserId
        ? {
            userId: r.headUserId,
            username: r.headUsername,
            displayName: r.headDisplayName || r.headUsername,
            email: r.headEmail,
            managerRoleCode: r.managerRoleCode,
          }
        : null,
    }));
  }
}
