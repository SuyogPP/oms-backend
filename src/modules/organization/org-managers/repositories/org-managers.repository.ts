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
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager[]> {
    const sql = `
      SELECT
        m.org_unit_manager_id AS orgUnitManagerId,
        m.org_unit_id AS orgUnitId,
        m.user_id AS userId,
        m.manager_role_code AS managerRoleCode,
        m.is_primary AS isPrimary,
        m.effective_from AS effectiveFrom,
        m.effective_to AS effectiveTo,
        m.is_active AS isActive,
        u.username AS username,
        u.email AS userEmail,
        CONCAT(u.first_name, ' ', u.last_name) AS userDisplayName,
        ou.org_name AS orgUnitName,
        ou.org_code AS orgUnitCode
      FROM [masters].[tbl_Org_Unit_Manager] m
      INNER JOIN auth.tbl_Users u ON u.user_id = m.user_id
      INNER JOIN [masters].[tbl_Org_Unit] ou ON ou.org_unit_id = m.org_unit_id
      WHERE m.org_unit_id = @0 AND m.is_active = 1
      ORDER BY m.effective_from DESC, m.is_primary DESC;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId]);
    if (rows.length > 0) {
      return rows;
    }

    // Fallback: Check if an active user has role 'HOD' / 'SECTION_HEAD' scoped to this orgUnitId or is ou.head_user_id
    const fallbackSql = `
      SELECT TOP 1
        CAST(NULL AS BIGINT) AS orgUnitManagerId,
        ou.org_unit_id AS orgUnitId,
        u.user_id AS userId,
        'HEAD' AS managerRoleCode,
        CAST(1 AS BIT) AS isPrimary,
        ou.effective_from AS effectiveFrom,
        ou.effective_to AS effectiveTo,
        CAST(1 AS BIT) AS isActive,
        u.username AS username,
        u.email AS userEmail,
        CASE
          WHEN u.first_name IS NOT NULL OR u.last_name IS NOT NULL THEN
            LTRIM(RTRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))))
          ELSE u.username
        END AS userDisplayName,
        ou.org_name AS orgUnitName,
        ou.org_code AS orgUnitCode
      FROM [masters].[tbl_Org_Unit] ou
      INNER JOIN auth.tbl_Users u ON (
        u.user_id = ou.head_user_id
        OR u.user_id IN (
          SELECT ur.user_id
          FROM auth.tbl_User_Roles ur
          INNER JOIN auth.tbl_Roles r ON r.role_id = ur.role_id
          WHERE ur.org_unit_id = ou.org_unit_id
            AND r.role_code IN ('HOD', 'SECTION_HEAD')
        )
      )
      WHERE ou.org_unit_id = @0 AND u.is_active = 1;
    `;
    return this.getExecutor(qr).query(fallbackSql, [orgUnitId]);
  }

  /**
   * Finds current active primary HEAD manager for an organization unit as of a given date (default today).
   * Per Rule G7, queries OrgUnitManagers directly with effective-date filtering.
   */
  async findCurrentHead(
    orgUnitId: number,
    asOfDate?: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager | null> {
    const dateParam = asOfDate || new Date().toISOString().split('T')[0];

    const sql = `
      SELECT TOP 1
        m.org_unit_manager_id AS orgUnitManagerId,
        m.org_unit_id AS orgUnitId,
        m.user_id AS userId,
        m.manager_role_code AS managerRoleCode,
        m.is_primary AS isPrimary,
        m.effective_from AS effectiveFrom,
        m.effective_to AS effectiveTo,
        m.is_active AS isActive,
        u.username AS username,
        u.email AS userEmail,
        CONCAT(u.first_name, ' ', u.last_name) AS userDisplayName,
        ou.org_name AS orgUnitName,
        ou.org_code AS orgUnitCode
      FROM [masters].[tbl_Org_Unit_Manager] m
      INNER JOIN auth.tbl_Users u ON u.user_id = m.user_id
      INNER JOIN [masters].[tbl_Org_Unit] ou ON ou.org_unit_id = m.org_unit_id
      WHERE m.org_unit_id = @0
        AND m.manager_role_code = '${ORG_MANAGER_ROLES.HEAD}'
        AND m.is_primary = 1
        AND m.is_active = 1
        AND m.effective_from <= CAST(@1 AS DATE)
        AND (m.effective_to IS NULL OR m.effective_to >= CAST(@1 AS DATE))
      ORDER BY m.effective_from DESC;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId, dateParam]);
    if (rows.length > 0) {
      return rows[0];
    }

    // Fallback
    const fallbackSql = `
      SELECT TOP 1
        CAST(NULL AS BIGINT) AS orgUnitManagerId,
        ou.org_unit_id AS orgUnitId,
        u.user_id AS userId,
        'HEAD' AS managerRoleCode,
        CAST(1 AS BIT) AS isPrimary,
        ou.effective_from AS effectiveFrom,
        ou.effective_to AS effectiveTo,
        CAST(1 AS BIT) AS isActive,
        u.username AS username,
        u.email AS userEmail,
        CASE
          WHEN u.first_name IS NOT NULL OR u.last_name IS NOT NULL THEN
            LTRIM(RTRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))))
          ELSE u.username
        END AS userDisplayName,
        ou.org_name AS orgUnitName,
        ou.org_code AS orgUnitCode
      FROM [masters].[tbl_Org_Unit] ou
      INNER JOIN auth.tbl_Users u ON (
        u.user_id = ou.head_user_id
        OR u.user_id IN (
          SELECT ur.user_id
          FROM auth.tbl_User_Roles ur
          INNER JOIN auth.tbl_Roles r ON r.role_id = ur.role_id
          WHERE ur.org_unit_id = ou.org_unit_id
            AND r.role_code IN ('HOD', 'SECTION_HEAD')
        )
      )
      WHERE ou.org_unit_id = @0 AND u.is_active = 1;
    `;
    const fallbackRows = await this.getExecutor(qr).query(fallbackSql, [orgUnitId]);
    return fallbackRows.length > 0 ? fallbackRows[0] : null;
  }

  /**
   * Retrieves a manager assignment by its ID.
   */
  async findById(
    orgUnitManagerId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager | null> {
    const sql = `
      SELECT
        m.org_unit_manager_id AS orgUnitManagerId,
        m.org_unit_id AS orgUnitId,
        m.user_id AS userId,
        m.manager_role_code AS managerRoleCode,
        m.is_primary AS isPrimary,
        m.effective_from AS effectiveFrom,
        m.effective_to AS effectiveTo,
        m.is_active AS isActive,
        u.username AS username,
        u.email AS userEmail,
        CONCAT(u.first_name, ' ', u.last_name) AS userDisplayName,
        ou.org_name AS orgUnitName,
        ou.org_code AS orgUnitCode
      FROM [masters].[tbl_Org_Unit_Manager] m
      INNER JOIN auth.tbl_Users u ON u.user_id = m.user_id
      INNER JOIN [masters].[tbl_Org_Unit] ou ON ou.org_unit_id = m.org_unit_id
      WHERE m.org_unit_manager_id = @0 AND m.is_active = 1;
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
        m.org_unit_manager_id AS orgUnitManagerId,
        m.org_unit_id AS orgUnitId,
        m.user_id AS userId,
        m.manager_role_code AS managerRoleCode,
        m.is_primary AS isPrimary,
        m.effective_from AS effectiveFrom,
        m.effective_to AS effectiveTo,
        m.is_active AS isActive,
        u.username AS username,
        u.email AS userEmail,
        CONCAT(u.first_name, ' ', u.last_name) AS userDisplayName,
        ou.org_name AS orgUnitName,
        ou.org_code AS orgUnitCode
      FROM [masters].[tbl_Org_Unit_Manager] m
      INNER JOIN auth.tbl_Users u ON u.user_id = m.user_id
      INNER JOIN [masters].[tbl_Org_Unit] ou ON ou.org_unit_id = m.org_unit_id
      WHERE m.user_id = @0 AND m.is_active = 1 AND ou.is_active = 1
      ORDER BY m.effective_from DESC, m.is_active DESC;
    `;
    return this.getExecutor(qr).query(sql, [userId]);
  }

  /**
   * Inserts a new manager assignment record.
   */
  async create(
    data: {
      orgUnitId: number;
      userId: string;
      managerRoleCode: string;
      isPrimary: boolean;
      effectiveFrom: string;
      effectiveTo?: string | null;
    },
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager> {
    const sql = `
      INSERT INTO [masters].[tbl_Org_Unit_Manager] (
        org_unit_id,
        user_id,
        manager_role_code,
        is_primary,
        effective_from,
        effective_to,
        is_active
      )
      OUTPUT
        INSERTED.org_unit_manager_id AS orgUnitManagerId,
        INSERTED.org_unit_id AS orgUnitId,
        INSERTED.user_id AS userId,
        INSERTED.manager_role_code AS managerRoleCode,
        INSERTED.is_primary AS isPrimary,
        INSERTED.effective_from AS effectiveFrom,
        INSERTED.effective_to AS effectiveTo,
        INSERTED.is_active AS isActive
      VALUES (
        @0, @1, @2, @3, @4, @5, 1
      );
    `;

    const params = [
      data.orgUnitId,
      data.userId,
      data.managerRoleCode,
      data.isPrimary ? 1 : 0,
      data.effectiveFrom,
      data.effectiveTo ?? null,
    ];

    const rows = await this.getExecutor(qr).query(sql, params);
    return rows[0];
  }

  /**
   * Updates an existing manager assignment record.
   */
  async update(
    orgUnitManagerId: number,
    data: {
      isPrimary?: boolean;
      effectiveTo?: string | null;
    },
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitManager> {
    const sql = `
      UPDATE [masters].[tbl_Org_Unit_Manager]
      SET
        is_primary = CASE WHEN @1 IS NOT NULL THEN @1 ELSE is_primary END,
        effective_to = CASE WHEN @2 IS NOT NULL THEN @2 ELSE effective_to END
      OUTPUT
        INSERTED.org_unit_manager_id AS orgUnitManagerId,
        INSERTED.org_unit_id AS orgUnitId,
        INSERTED.user_id AS userId,
        INSERTED.manager_role_code AS managerRoleCode,
        INSERTED.is_primary AS isPrimary,
        INSERTED.effective_from AS effectiveFrom,
        INSERTED.effective_to AS effectiveTo,
        INSERTED.is_active AS isActive
      WHERE org_unit_manager_id = @0 AND is_active = 1;
    `;

    const params = [
      orgUnitManagerId,
      data.isPrimary !== undefined ? (data.isPrimary ? 1 : 0) : null,
      data.effectiveTo !== undefined ? data.effectiveTo : null,
    ];

    const rows = await this.getExecutor(qr).query(sql, params);
    return rows[0];
  }

  /**
   * §7.4 Rule G2: Auto-ends the previous primary HEAD by setting its EffectiveTo
   * to (newEffectiveFrom - 1 day). Executed in the same transaction.
   */
  async endPreviousPrimaryHead(
    orgUnitId: number,
    newEffectiveFrom: string,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE [masters].[tbl_Org_Unit_Manager]
      SET
        effective_to = DATEADD(DAY, -1, CAST(@1 AS DATE))
      WHERE org_unit_id = @0
        AND manager_role_code = '${ORG_MANAGER_ROLES.HEAD}'
        AND is_primary = 1
        AND is_active = 1
        AND (effective_to IS NULL OR effective_to >= CAST(@1 AS DATE));
    `;
    await this.getExecutor(qr).query(sql, [
      orgUnitId,
      newEffectiveFrom,
    ]);
  }

  /**
   * Soft deletes a manager assignment.
   */
  async softDelete(
    orgUnitManagerId: number,
    actorUserId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE [masters].[tbl_Org_Unit_Manager]
      SET
        is_active = 0
      WHERE org_unit_manager_id = @0;
    `;
    await this.getExecutor(qr).query(sql, [orgUnitManagerId]);
  }

  /**
   * §8.4 / Rule G7: Hierarchical approval chain resolution.
   * Uses recursive CTE instead of closure table!
   */
  async getApprovalChain(
    orgUnitId: number,
    asOfDate?: string,
    qr?: QueryRunner,
  ): Promise<any[]> {
    const dateParam = asOfDate || new Date().toISOString().split('T')[0];

    const sql = `
      WITH CTE_Org AS (
        SELECT 
          org_unit_id,
          parent_id,
          org_code,
          org_name,
          1 AS distance
        FROM [masters].[tbl_Org_Unit]
        WHERE org_unit_id = @0 AND is_active = 1
        
        UNION ALL
        
        SELECT 
          u.org_unit_id,
          u.parent_id,
          u.org_code,
          u.org_name,
          c.distance + 1
        FROM [masters].[tbl_Org_Unit] u
        INNER JOIN CTE_Org c ON u.org_unit_id = c.parent_id
        WHERE u.is_active = 1
      )
      SELECT
        c.distance AS distance,
        c.org_unit_id AS orgUnitId,
        c.org_code AS orgUnitCode,
        c.org_name AS orgUnitName,
        m.user_id AS headUserId,
        usr.username AS headUsername,
        CONCAT(usr.first_name, ' ', usr.last_name) AS headDisplayName,
        usr.email AS headEmail,
        m.manager_role_code AS managerRoleCode
      FROM CTE_Org c
      LEFT JOIN [masters].[tbl_Org_Unit_Manager] m
             ON m.org_unit_id = c.org_unit_id
            AND m.manager_role_code = '${ORG_MANAGER_ROLES.HEAD}'
            AND m.is_primary = 1
            AND m.is_active = 1
            AND m.effective_from <= @1
            AND (m.effective_to IS NULL OR m.effective_to >= @1)
      LEFT JOIN auth.tbl_Users usr ON usr.user_id = m.user_id
      ORDER BY c.distance ASC;
    `;

    const rows = await this.getExecutor(qr).query(sql, [orgUnitId, dateParam]);

    return rows.map((r: any, idx: number) => ({
      step: idx + 1,
      distance: r.distance,
      orgUnitId: r.orgUnitId,
      orgUnitCode: r.orgUnitCode,
      orgUnitName: r.orgUnitName,
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
