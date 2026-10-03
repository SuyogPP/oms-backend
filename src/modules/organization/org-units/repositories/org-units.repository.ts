import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IOrgUnit } from '../interfaces/org-unit.interface';

@Injectable()
export class OrgUnitsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  async findById(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnit | null> {
    const sql = `
      SELECT
        u.org_unit_id AS orgUnitId,
        u.parent_id AS parentId,
        u.unit_type_id AS unitTypeId,
        u.org_code AS orgCode,
        u.org_name AS orgName,
        u.cost_center_code AS costCenterCode,
        u.ad_object_guid AS adObjectGuid,
        u.is_active AS isActive
      FROM [masters].[tbl_Org_Unit] u
      WHERE u.org_unit_id = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findByIdVisible(
    orgUnitId: number,
    userId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit | null> {
    const sql = `
      SELECT
        u.org_unit_id AS orgUnitId,
        u.parent_id AS parentId,
        u.unit_type_id AS unitTypeId,
        u.org_code AS orgCode,
        u.org_name AS orgName,
        u.cost_center_code AS costCenterCode,
        u.ad_object_guid AS adObjectGuid,
        u.is_active AS isActive
      FROM [masters].[tbl_Org_Unit] u
      INNER JOIN org.fn_VisibleOrgUnits(@1) v ON v.OrgUnitId = u.org_unit_id
      WHERE u.org_unit_id = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId, userId]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findByIdIncludingDeleted(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnit | null> {
    return this.findById(orgUnitId, qr);
  }

  async findByCode(
    parentId: number | null,
    code: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit | null> {
    const sql = `
      SELECT
        u.org_unit_id AS orgUnitId,
        u.parent_id AS parentId,
        u.unit_type_id AS unitTypeId,
        u.org_code AS orgCode,
        u.org_name AS orgName,
        u.cost_center_code AS costCenterCode,
        u.ad_object_guid AS adObjectGuid,
        u.is_active AS isActive
      FROM [masters].[tbl_Org_Unit] u
      WHERE u.org_code = @0
        AND ((@1 IS NULL AND u.parent_id IS NULL) OR (u.parent_id = @1));
    `;
    const rows = await this.getExecutor(qr).query(sql, [code, parentId]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findActiveRoot(qr?: QueryRunner): Promise<IOrgUnit | null> {
    const sql = `
      SELECT
        u.org_unit_id AS orgUnitId,
        u.parent_id AS parentId,
        u.unit_type_id AS unitTypeId,
        u.org_code AS orgCode,
        u.org_name AS orgName,
        u.cost_center_code AS costCenterCode,
        u.ad_object_guid AS adObjectGuid,
        u.is_active AS isActive
      FROM [masters].[tbl_Org_Unit] u
      INNER JOIN [masters].[tbl_Org_Unit_Types] t ON t.unit_type_id = u.unit_type_id
      WHERE u.parent_id IS NULL 
        AND t.level = 1
        AND u.is_active = 1;
    `;
    const rows = await this.getExecutor(qr).query(sql);
    return rows.length > 0 ? rows[0] : null;
  }

  async findChildren(
    parentId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      SELECT
        u.org_unit_id AS orgUnitId,
        u.parent_id AS parentId,
        u.unit_type_id AS unitTypeId,
        u.org_code AS orgCode,
        u.org_name AS orgName,
        u.cost_center_code AS costCenterCode,
        u.ad_object_guid AS adObjectGuid,
        u.is_active AS isActive
      FROM [masters].[tbl_Org_Unit] u
      WHERE u.parent_id = @0
      ORDER BY u.org_name ASC;
    `;
    return this.getExecutor(qr).query(sql, [parentId]);
  }

  async findChildrenVisible(
    parentId: number,
    userId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      SELECT
        u.org_unit_id AS orgUnitId,
        u.parent_id AS parentId,
        u.unit_type_id AS unitTypeId,
        u.org_code AS orgCode,
        u.org_name AS orgName,
        u.cost_center_code AS costCenterCode,
        u.ad_object_guid AS adObjectGuid,
        u.is_active AS isActive
      FROM [masters].[tbl_Org_Unit] u
      INNER JOIN org.fn_VisibleOrgUnits(@1) v ON v.OrgUnitId = u.org_unit_id
      WHERE u.parent_id = @0
      ORDER BY u.org_name ASC;
    `;
    return this.getExecutor(qr).query(sql, [parentId, userId]);
  }

  async findAncestors(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      WITH OrgPath AS (
        SELECT org_unit_id, parent_id, unit_type_id, org_code, org_name, cost_center_code, ad_object_guid, is_active, 1 AS depth
        FROM [masters].[tbl_Org_Unit] 
        WHERE org_unit_id = @0
        
        UNION ALL
        
        SELECT ou.org_unit_id, ou.parent_id, ou.unit_type_id, ou.org_code, ou.org_name, ou.cost_center_code, ou.ad_object_guid, ou.is_active, p.depth + 1
        FROM [masters].[tbl_Org_Unit] ou
        INNER JOIN OrgPath p ON ou.org_unit_id = p.parent_id
      )
      SELECT 
        org_unit_id AS orgUnitId,
        parent_id AS parentId,
        unit_type_id AS unitTypeId,
        org_code AS orgCode,
        org_name AS orgName,
        cost_center_code AS costCenterCode,
        ad_object_guid AS adObjectGuid,
        is_active AS isActive
      FROM OrgPath 
      WHERE org_unit_id <> @0
      ORDER BY depth DESC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId]);
  }

  async findAncestorsVisible(
    orgUnitId: number,
    userId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      WITH OrgPath AS (
        SELECT org_unit_id, parent_id, unit_type_id, org_code, org_name, cost_center_code, ad_object_guid, is_active, 1 AS depth
        FROM [masters].[tbl_Org_Unit] 
        WHERE org_unit_id = @0
        
        UNION ALL
        
        SELECT ou.org_unit_id, ou.parent_id, ou.unit_type_id, ou.org_code, ou.org_name, ou.cost_center_code, ou.ad_object_guid, ou.is_active, p.depth + 1
        FROM [masters].[tbl_Org_Unit] ou
        INNER JOIN OrgPath p ON ou.org_unit_id = p.parent_id
      )
      SELECT 
        p.org_unit_id AS orgUnitId,
        p.parent_id AS parentId,
        p.unit_type_id AS unitTypeId,
        p.org_code AS orgCode,
        p.org_name AS orgName,
        p.cost_center_code AS costCenterCode,
        p.ad_object_guid AS adObjectGuid,
        p.is_active AS isActive
      FROM OrgPath p
      INNER JOIN org.fn_VisibleOrgUnits(@1) v ON v.OrgUnitId = p.org_unit_id
      WHERE p.org_unit_id <> @0
      ORDER BY p.depth DESC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId, userId]);
  }

  async findDescendants(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      WITH OrgTree AS (
        SELECT org_unit_id, parent_id, unit_type_id, org_code, org_name, cost_center_code, ad_object_guid, is_active, 1 AS depth
        FROM [masters].[tbl_Org_Unit] 
        WHERE org_unit_id = @0
        
        UNION ALL
        
        SELECT ou.org_unit_id, ou.parent_id, ou.unit_type_id, ou.org_code, ou.org_name, ou.cost_center_code, ou.ad_object_guid, ou.is_active, t.depth + 1
        FROM [masters].[tbl_Org_Unit] ou
        INNER JOIN OrgTree t ON ou.parent_id = t.org_unit_id
      )
      SELECT 
        org_unit_id AS orgUnitId,
        parent_id AS parentId,
        unit_type_id AS unitTypeId,
        org_code AS orgCode,
        org_name AS orgName,
        cost_center_code AS costCenterCode,
        ad_object_guid AS adObjectGuid,
        is_active AS isActive
      FROM OrgTree 
      WHERE org_unit_id <> @0
      ORDER BY depth ASC, org_name ASC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId]);
  }

  async findDescendantsVisible(
    orgUnitId: number,
    userId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      WITH OrgTree AS (
        SELECT org_unit_id, parent_id, unit_type_id, org_code, org_name, cost_center_code, ad_object_guid, is_active, 1 AS depth
        FROM [masters].[tbl_Org_Unit] 
        WHERE org_unit_id = @0
        
        UNION ALL
        
        SELECT ou.org_unit_id, ou.parent_id, ou.unit_type_id, ou.org_code, ou.org_name, ou.cost_center_code, ou.ad_object_guid, ou.is_active, t.depth + 1
        FROM [masters].[tbl_Org_Unit] ou
        INNER JOIN OrgTree t ON ou.parent_id = t.org_unit_id
      )
      SELECT 
        t.org_unit_id AS orgUnitId,
        t.parent_id AS parentId,
        t.unit_type_id AS unitTypeId,
        t.org_code AS orgCode,
        t.org_name AS orgName,
        t.cost_center_code AS costCenterCode,
        t.ad_object_guid AS adObjectGuid,
        t.is_active AS isActive
      FROM OrgTree t
      INNER JOIN org.fn_VisibleOrgUnits(@1) v ON v.OrgUnitId = t.org_unit_id
      WHERE t.org_unit_id <> @0
      ORDER BY t.depth ASC, t.org_name ASC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId, userId]);
  }

  async countDirectChildren(
    orgUnitId: number,
    onlyActive = false,
    qr?: QueryRunner,
  ): Promise<number> {
    const sql = `
      SELECT COUNT(*) AS total
      FROM [masters].[tbl_Org_Unit]
      WHERE parent_id = @0 
        ${onlyActive ? 'AND is_active = 1' : ''};
    `;
    const res = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return Number(res[0]?.total || 0);
  }

  async countSubtreeDescendants(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<number> {
    const sql = `
      WITH OrgTree AS (
        SELECT org_unit_id
        FROM [masters].[tbl_Org_Unit] 
        WHERE org_unit_id = @0
        
        UNION ALL
        
        SELECT ou.org_unit_id
        FROM [masters].[tbl_Org_Unit] ou
        INNER JOIN OrgTree t ON ou.parent_id = t.org_unit_id
      )
      SELECT COUNT(*) AS total
      FROM OrgTree
      WHERE org_unit_id <> @0;
    `;
    const res = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return Number(res[0]?.total || 0);
  }

  async findAllVisible(
    userId: string,
    options: {
      unitTypeId?: number;
      parentId?: number;
      search?: string;
      isActive?: boolean;
      offset?: number;
      limit?: number;
    },
    qr?: QueryRunner,
  ): Promise<[IOrgUnit[], number]> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 20;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM [masters].[tbl_Org_Unit] u
      INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.org_unit_id
      WHERE (@1 IS NULL OR u.unit_type_id = @1)
        AND (@2 IS NULL OR u.parent_id = @2)
        AND (@3 IS NULL OR (u.org_name LIKE '%' + @3 + '%' OR u.org_code LIKE '%' + @3 + '%'))
        AND (@4 IS NULL OR u.is_active = @4);
    `;

    const countParams = [
      userId,
      options.unitTypeId ?? null,
      options.parentId ?? null,
      options.search ?? null,
      options.isActive !== undefined ? (options.isActive ? 1 : 0) : null,
    ];

    const countRes = await this.getExecutor(qr).query(countSql, countParams);
    const total = Number(countRes[0]?.total || 0);

    const dataSql = `
      WITH NumberedRows AS (
        SELECT
          u.org_unit_id AS orgUnitId,
          u.parent_id AS parentId,
          u.unit_type_id AS unitTypeId,
          u.org_code AS orgCode,
          u.org_name AS orgName,
          u.cost_center_code AS costCenterCode,
          u.ad_object_guid AS adObjectGuid,
          u.is_active AS isActive,
          ROW_NUMBER() OVER (ORDER BY u.org_name ASC) AS RowNum
        FROM [masters].[tbl_Org_Unit] u
        INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.org_unit_id
        WHERE (@1 IS NULL OR u.unit_type_id = @1)
          AND (@2 IS NULL OR u.parent_id = @2)
          AND (@3 IS NULL OR (u.org_name LIKE '%' + @3 + '%' OR u.org_code LIKE '%' + @3 + '%'))
          AND (@4 IS NULL OR u.is_active = @4)
      )
      SELECT *
      FROM NumberedRows
      WHERE RowNum > @5 AND RowNum <= (@5 + @6)
      ORDER BY RowNum;
    `;

    const dataParams = [...countParams, offset, limit];
    const rows = await this.getExecutor(qr).query(dataSql, dataParams);
    return [rows, total];
  }

  async findVisibleTree(userId: string, qr?: QueryRunner): Promise<IOrgUnit[]> {
    const sql = `
      SELECT
        u.org_unit_id AS orgUnitId,
        u.parent_id AS parentId,
        u.unit_type_id AS unitTypeId,
        u.org_code AS orgCode,
        u.org_name AS orgName,
        u.is_active AS isActive
      FROM [masters].[tbl_Org_Unit] u
      INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.org_unit_id
      ORDER BY u.org_name ASC;
    `;
    return this.getExecutor(qr).query(sql, [userId]);
  }

  async create(
    data: {
      unitTypeId: number;
      parentId?: number | null;
      orgCode: string;
      orgName: string;
      costCenterCode?: string | null;
      adObjectGuid?: string | null;
      isActive: boolean;
    },
    qr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const sql = `
      INSERT INTO [masters].[tbl_Org_Unit] (
        unit_type_id,
        parent_id,
        org_code,
        org_name,
        cost_center_code,
        ad_object_guid,
        is_active
      )
      OUTPUT 
        INSERTED.org_unit_id AS orgUnitId,
        INSERTED.unit_type_id AS unitTypeId,
        INSERTED.parent_id AS parentId,
        INSERTED.org_code AS orgCode,
        INSERTED.org_name AS orgName,
        INSERTED.cost_center_code AS costCenterCode,
        INSERTED.ad_object_guid AS adObjectGuid,
        INSERTED.is_active AS isActive
      VALUES (
        @0, @1, @2, @3, @4, @5, @6
      );
    `;

    const params = [
      data.unitTypeId,
      data.parentId ?? null,
      data.orgCode,
      data.orgName,
      data.costCenterCode ?? null,
      data.adObjectGuid ?? null,
      data.isActive ? 1 : 0,
    ];

    const rows = await this.getExecutor(qr).query(sql, params);
    return rows[0];
  }

  async update(
    orgUnitId: number,
    data: {
      orgCode?: string;
      orgName?: string;
      costCenterCode?: string | null;
      adObjectGuid?: string | null;
      isActive?: boolean;
    },
    qr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const sql = `
      UPDATE [masters].[tbl_Org_Unit]
      SET
        org_code = COALESCE(@1, org_code),
        org_name = COALESCE(@2, org_name),
        cost_center_code = CASE WHEN @3 IS NOT NULL THEN @3 ELSE cost_center_code END,
        ad_object_guid = CASE WHEN @4 IS NOT NULL THEN @4 ELSE ad_object_guid END,
        is_active = COALESCE(@5, is_active)
      OUTPUT
        INSERTED.org_unit_id AS orgUnitId,
        INSERTED.unit_type_id AS unitTypeId,
        INSERTED.parent_id AS parentId,
        INSERTED.org_code AS orgCode,
        INSERTED.org_name AS orgName,
        INSERTED.cost_center_code AS costCenterCode,
        INSERTED.ad_object_guid AS adObjectGuid,
        INSERTED.is_active AS isActive
      WHERE org_unit_id = @0;
    `;

    const params = [
      orgUnitId,
      data.orgCode ?? null,
      data.orgName ?? null,
      data.costCenterCode !== undefined ? data.costCenterCode : null,
      data.adObjectGuid !== undefined ? data.adObjectGuid : null,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : null,
    ];

    const rows = await this.getExecutor(qr).query(sql, params);
    return rows[0];
  }

  async updateParentAndSubtreeDepth(
    nodeId: number,
    newParentId: number,
    actorUserId: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    const sqlAdjacency = `
      UPDATE [masters].[tbl_Org_Unit]
      SET parent_id = @1
      WHERE org_unit_id = @0;
    `;
    await this.getExecutor(qr).query(sqlAdjacency, [nodeId, newParentId]);
  }

  async rebuildSubtreePaths(nodeId: number, qr?: QueryRunner): Promise<void> {
    // No-op. Materialized path is gone.
  }

  async updateHeadUser(
    orgUnitId: number,
    headUserId: string | null,
    actorUserId: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    // No-op. Head user is gone from this table. Managed in OrgUnitManagers.
  }

  async setActiveStatus(
    orgUnitId: number,
    isActive: boolean,
    effectiveTo: string | null,
    actorUserId: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE [masters].[tbl_Org_Unit]
      SET is_active = @1
      WHERE org_unit_id = @0;
    `;
    await this.getExecutor(qr).query(sql, [orgUnitId, isActive ? 1 : 0]);
  }

  async softDelete(
    orgUnitId: number,
    deletedBy: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE [masters].[tbl_Org_Unit]
      SET is_active = 0
      WHERE org_unit_id = @0;
    `;
    await this.getExecutor(qr).query(sql, [orgUnitId]);
  }

  async findBudgetOwner(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnit | null> {
    const sql = `
      WITH OrgPath AS (
        SELECT org_unit_id, parent_id, unit_type_id, org_code, org_name, cost_center_code, ad_object_guid, is_active, 1 AS depth
        FROM [masters].[tbl_Org_Unit] 
        WHERE org_unit_id = @0
        
        UNION ALL
        
        SELECT ou.org_unit_id, ou.parent_id, ou.unit_type_id, ou.org_code, ou.org_name, ou.cost_center_code, ou.ad_object_guid, ou.is_active, p.depth + 1
        FROM [masters].[tbl_Org_Unit] ou
        INNER JOIN OrgPath p ON ou.org_unit_id = p.parent_id
      )
      SELECT TOP 1
        p.org_unit_id AS orgUnitId,
        p.parent_id AS parentId,
        p.unit_type_id AS unitTypeId,
        p.org_code AS orgCode,
        p.org_name AS orgName,
        p.cost_center_code AS costCenterCode,
        p.ad_object_guid AS adObjectGuid,
        p.is_active AS isActive
      FROM OrgPath p
      INNER JOIN [masters].[tbl_Org_Unit_Types] t ON t.unit_type_id = p.unit_type_id
      WHERE t.allows_budget = 1
        AND p.is_active = 1
      ORDER BY p.depth ASC;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return rows.length > 0 ? rows[0] : null;
  }

  async countForExport(
    userId: string,
    filters: {
      unitTypeId?: number;
      parentId?: number;
      search?: string;
      isActive?: boolean;
    },
    qr?: QueryRunner,
  ): Promise<number> {
    const sql = `
      SELECT COUNT(1) AS total
      FROM [masters].[tbl_Org_Unit] u
      INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.org_unit_id
      WHERE (@1 IS NULL OR u.unit_type_id = @1)
        AND (@2 IS NULL OR u.parent_id = @2)
        AND (@3 IS NULL OR (u.org_code LIKE '%' + @3 + '%' OR u.org_name LIKE '%' + @3 + '%'))
        AND (@4 IS NULL OR u.is_active = @4);
    `;
    const rows = await this.getExecutor(qr).query(sql, [
      userId,
      filters.unitTypeId ?? null,
      filters.parentId ?? null,
      filters.search ?? null,
      filters.isActive !== undefined ? (filters.isActive ? 1 : 0) : null,
    ]);
    return Number(rows[0]?.total ?? 0);
  }

  async findForExport(
    userId: string,
    filters: {
      unitTypeId?: number;
      parentId?: number;
      search?: string;
      isActive?: boolean;
    },
    qr?: QueryRunner,
  ): Promise<any[]> {
    const sql = `
      SELECT
        u.org_unit_id AS orgUnitId,
        u.org_code AS orgCode,
        u.org_name AS orgName,
        t.org_unit_name AS typeName,
        t.org_unit_code AS typeCode,
        p.org_code AS parentCode,
        p.org_name AS parentName,
        u.cost_center_code AS costCenterCode,
        u.is_active AS isActive
      FROM [masters].[tbl_Org_Unit] u
      INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.org_unit_id
      INNER JOIN [masters].[tbl_Org_Unit_Types] t ON t.unit_type_id = u.unit_type_id
      LEFT JOIN [masters].[tbl_Org_Unit] p ON p.org_unit_id = u.parent_id
      WHERE (@1 IS NULL OR u.unit_type_id = @1)
        AND (@2 IS NULL OR u.parent_id = @2)
        AND (@3 IS NULL OR (u.org_code LIKE '%' + @3 + '%' OR u.org_name LIKE '%' + @3 + '%'))
        AND (@4 IS NULL OR u.is_active = @4)
      ORDER BY u.org_name ASC;
    `;
    return this.getExecutor(qr).query(sql, [
      userId,
      filters.unitTypeId ?? null,
      filters.parentId ?? null,
      filters.search ?? null,
      filters.isActive !== undefined ? (filters.isActive ? 1 : 0) : null,
    ]);
  }

  async findUserDisplayName(
    userId: string,
    qr?: QueryRunner,
  ): Promise<{
    userId: string;
    username: string;
    displayName: string | null;
  } | null> {
    const sql = `
      SELECT
        u.user_id AS userId,
        u.username AS username,
        CASE
          WHEN u.first_name IS NOT NULL THEN CONCAT(u.first_name, ' ', u.last_name)
          ELSE u.username
        END AS displayName
      FROM auth.tbl_Users u
      WHERE u.user_id = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [userId]);
    return rows.length > 0 ? rows[0] : null;
  }

  async countPeople(orgUnitId: number, qr?: QueryRunner): Promise<number> {
    const sql = `
      SELECT COUNT(DISTINCT u.user_id) AS total
      FROM auth.tbl_Users u
      LEFT JOIN auth.tbl_User_Roles s ON s.user_id = u.user_id
      LEFT JOIN org.OrgUnitManagers m ON m.UserId = u.user_id AND m.OrgUnitId = @0 AND m.is_active = 1 AND m.IsDeleted = 0
      WHERE u.is_active = 1
        AND (
          s.org_unit_id = @0
          OR u.org_unit_id = @0
          OR m.OrgUnitId = @0
        );
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return Number(rows[0]?.total ?? 0);
  }

  async findMembers(
    orgUnitId: number,
    qr?: QueryRunner,
  ): Promise<any[]> {
    const sql = `
      WITH UnitMembers AS (
        SELECT DISTINCT
          u.user_id AS userId,
          u.username AS username,
          u.email AS email,
          u.is_active AS isActive,
          CASE
            WHEN u.first_name IS NOT NULL OR u.last_name IS NOT NULL THEN
              LTRIM(RTRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))))
            ELSE u.username
          END AS displayName,
          u.job_title AS jobTitle,
          u.mobile_no AS mobileNo,
          CASE 
            WHEN mgr.manager_role_code = 'HEAD' OR EXISTS (
              SELECT 1 FROM auth.tbl_User_Roles ur 
              INNER JOIN auth.tbl_Roles r ON r.role_id = ur.role_id 
              WHERE ur.user_id = u.user_id AND r.role_code IN ('HOD', 'SECTION_HEAD')
            ) THEN 1 
            ELSE 0 
          END AS isHead,
          mgr.manager_role_code AS managerRoleCode,
          (
            SELECT STRING_AGG(r.role_name, ', ')
            FROM auth.tbl_User_Roles ur
            INNER JOIN auth.tbl_Roles r ON r.role_id = ur.role_id
            WHERE ur.user_id = u.user_id
          ) AS rolesString
        FROM auth.tbl_Users u
        LEFT JOIN auth.tbl_User_Roles s ON s.user_id = u.user_id
        LEFT JOIN (
          SELECT m.UserId, m.manager_role_code
          FROM org.OrgUnitManagers m
          WHERE m.OrgUnitId = @0 AND m.is_active = 1 AND m.IsDeleted = 0
        ) mgr ON mgr.UserId = u.user_id
        WHERE u.is_active = 1
          AND (
            s.org_unit_id = @0
            OR u.org_unit_id = @0
            OR mgr.UserId IS NOT NULL
          )
      )
      SELECT *
      FROM UnitMembers
      ORDER BY isHead DESC, displayName ASC;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return rows.map((r: any) => ({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName || r.username,
      email: r.email,
      jobTitle: r.jobTitle,
      mobileNo: r.mobileNo,
      isHead: Boolean(r.isHead),
      managerRoleCode: r.managerRoleCode || (Boolean(r.isHead) ? 'HEAD' : null),
      roles: r.rolesString ? r.rolesString.split(', ') : [],
      isActive: Boolean(r.isActive),
    }));
  }
}
