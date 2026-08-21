import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IOrgUnit } from '../interfaces/org-unit.interface';

@Injectable()
export class OrgUnitsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Finds a non-deleted organization unit by its ID.
   */
  async findById(orgUnitId: string, qr?: QueryRunner): Promise<IOrgUnit | null> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        u.DeletedBy AS deletedBy,
        u.DeletedAt AS deletedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      WHERE u.OrgUnitId = @0 AND u.IsDeleted = 0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * §9.3 Non-Negotiable #1 & #2:
   * Finds an organization unit by ID strictly within the caller's visible scope via org.fn_VisibleOrgUnits.
   * Returns null if the unit is outside the caller's scope (enables 404 response).
   */
  async findByIdVisible(
    orgUnitId: string,
    userId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit | null> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      INNER JOIN org.fn_VisibleOrgUnits(@1) v ON v.OrgUnitId = u.OrgUnitId
      WHERE u.OrgUnitId = @0 AND u.IsDeleted = 0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId, userId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Finds an organization unit by ID including soft-deleted ones.
   */
  async findByIdIncludingDeleted(
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit | null> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        u.DeletedBy AS deletedBy,
        u.DeletedAt AS deletedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      WHERE u.OrgUnitId = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Finds a non-deleted organization unit by Code among siblings (or at root level).
   */
  async findByCode(
    parentOrgUnitId: string | null,
    code: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit | null> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        u.DeletedBy AS deletedBy,
        u.DeletedAt AS deletedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      WHERE u.Code = @0
        AND ((@1 IS NULL AND u.ParentOrgUnitId IS NULL) OR (u.ParentOrgUnitId = @1))
        AND u.IsDeleted = 0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [code, parentOrgUnitId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Finds an active root organization unit (type ORGANIZATION with NULL parent).
   */
  async findActiveRoot(qr?: QueryRunner): Promise<IOrgUnit | null> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        u.DeletedBy AS deletedBy,
        u.DeletedAt AS deletedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      WHERE u.ParentOrgUnitId IS NULL 
        AND u.OrgUnitTypeId = 1
        AND u.IsDeleted = 0 
        AND u.IsActive = 1;
    `;
    const rows = await this.getExecutor(qr).query(sql);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Finds direct child nodes of a parent org unit.
   */
  async findChildren(
    parentOrgUnitId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      WHERE u.ParentOrgUnitId = @0 AND u.IsDeleted = 0
      ORDER BY u.SortOrder ASC, u.Name ASC;
    `;
    return this.getExecutor(qr).query(sql, [parentOrgUnitId]);
  }

  /**
   * Finds direct child nodes strictly within the caller's visible scope.
   */
  async findChildrenVisible(
    parentOrgUnitId: string,
    userId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      INNER JOIN org.fn_VisibleOrgUnits(@1) v ON v.OrgUnitId = u.OrgUnitId
      WHERE u.ParentOrgUnitId = @0 AND u.IsDeleted = 0
      ORDER BY u.SortOrder ASC, u.Name ASC;
    `;
    return this.getExecutor(qr).query(sql, [parentOrgUnitId, userId]);
  }

  /**
   * Retrieves all ordered ancestors of an org unit (from root down to parent).
   */
  async findAncestors(
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      INNER JOIN org.OrgUnitClosure c ON c.AncestorOrgUnitId = u.OrgUnitId
      WHERE c.DescendantOrgUnitId = @0 
        AND c.Depth > 0
        AND u.IsDeleted = 0
      ORDER BY c.Depth DESC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId]);
  }

  /**
   * Retrieves ordered ancestors of an org unit within the caller's visible scope.
   */
  async findAncestorsVisible(
    orgUnitId: string,
    userId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      INNER JOIN org.OrgUnitClosure c ON c.AncestorOrgUnitId = u.OrgUnitId
      INNER JOIN org.fn_VisibleOrgUnits(@1) v ON v.OrgUnitId = u.OrgUnitId
      WHERE c.DescendantOrgUnitId = @0 
        AND c.Depth > 0
        AND u.IsDeleted = 0
      ORDER BY c.Depth DESC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId, userId]);
  }

  /**
   * Retrieves all flat descendants of an org unit.
   */
  async findDescendants(
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      INNER JOIN org.OrgUnitClosure c ON c.DescendantOrgUnitId = u.OrgUnitId
      WHERE c.AncestorOrgUnitId = @0 
        AND c.Depth > 0
        AND u.IsDeleted = 0
      ORDER BY c.Depth ASC, u.SortOrder ASC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId]);
  }

  /**
   * Retrieves flat descendants strictly within the caller's visible scope.
   */
  async findDescendantsVisible(
    orgUnitId: string,
    userId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      INNER JOIN org.OrgUnitClosure c ON c.DescendantOrgUnitId = u.OrgUnitId
      INNER JOIN org.fn_VisibleOrgUnits(@1) v ON v.OrgUnitId = u.OrgUnitId
      WHERE c.AncestorOrgUnitId = @0 
        AND c.Depth > 0
        AND u.IsDeleted = 0
      ORDER BY c.Depth ASC, u.SortOrder ASC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId, userId]);
  }

  /**
   * Counts direct children of an org unit (active or soft-deleted check).
   */
  async countDirectChildren(
    orgUnitId: string,
    onlyActive = false,
    qr?: QueryRunner,
  ): Promise<number> {
    const sql = `
      SELECT COUNT(*) AS total
      FROM org.OrgUnits
      WHERE ParentOrgUnitId = @0 
        AND IsDeleted = 0
        ${onlyActive ? 'AND IsActive = 1' : ''};
    `;
    const res = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return Number(res[0]?.total || 0);
  }

  /**
   * Counts total subtree descendants of an org unit.
   */
  async countSubtreeDescendants(
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<number> {
    const sql = `
      SELECT COUNT(*) AS total
      FROM org.OrgUnitClosure c
      INNER JOIN org.OrgUnits u ON u.OrgUnitId = c.DescendantOrgUnitId
      WHERE c.AncestorOrgUnitId = @0 
        AND c.Depth > 0
        AND u.IsDeleted = 0;
    `;
    const res = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return Number(res[0]?.total || 0);
  }

  /**
   * Retrieves paginated, filtered org units within user scope.
   */
  async findAllVisible(
    userId: string,
    options: {
      orgUnitTypeId?: number;
      depth?: number;
      parentOrgUnitId?: string;
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
      FROM org.OrgUnits u
      INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.OrgUnitId
      WHERE u.IsDeleted = 0
        AND (@1 IS NULL OR u.OrgUnitTypeId = @1)
        AND (@2 IS NULL OR u.ParentOrgUnitId = @2)
        AND (@3 IS NULL OR (u.Name LIKE '%' + @3 + '%' OR u.Code LIKE '%' + @3 + '%'))
        AND (@4 IS NULL OR u.IsActive = @4)
        AND (@5 IS NULL OR u.Depth = @5);
    `;

    const countParams = [
      userId,
      options.orgUnitTypeId ?? null,
      options.parentOrgUnitId ?? null,
      options.search ?? null,
      options.isActive !== undefined ? (options.isActive ? 1 : 0) : null,
      options.depth !== undefined ? options.depth : null,
    ];

    const countRes = await this.getExecutor(qr).query(countSql, countParams);
    const total = Number(countRes[0]?.total || 0);

    const dataSql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.ADObjectGuid AS adObjectGuid,
        u.ADDistinguishedName AS adDistinguishedName,
        u.OracleOrgCode AS oracleOrgCode,
        u.HeadUserId AS headUserId,
        u.EmailAddress AS emailAddress,
        u.PhoneNumber AS phoneNumber,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        u.CreatedBy AS createdBy,
        u.CreatedAt AS createdAt,
        u.UpdatedBy AS updatedBy,
        u.UpdatedAt AS updatedAt,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.OrgUnitId
      WHERE u.IsDeleted = 0
        AND (@1 IS NULL OR u.OrgUnitTypeId = @1)
        AND (@2 IS NULL OR u.ParentOrgUnitId = @2)
        AND (@3 IS NULL OR (u.Name LIKE '%' + @3 + '%' OR u.Code LIKE '%' + @3 + '%'))
        AND (@4 IS NULL OR u.IsActive = @4)
        AND (@5 IS NULL OR u.Depth = @5)
      ORDER BY u.Depth ASC, u.SortOrder ASC, u.Name ASC
      OFFSET @6 ROWS FETCH NEXT @7 ROWS ONLY;
    `;

    const dataParams = [...countParams, offset, limit];
    const rows = await this.getExecutor(qr).query(dataSql, dataParams);
    return [rows, total];
  }

  /**
   * Retrieves all visible org units for constructing tree hierarchy.
   */
  async findVisibleTree(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit[]> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Depth AS depth,
        u.SortOrder AS sortOrder,
        u.IsActive AS isActive,
        u.HeadUserId AS headUserId,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.OrgUnitId
      WHERE u.IsDeleted = 0
      ORDER BY u.Depth ASC, u.SortOrder ASC, u.Name ASC;
    `;
    return this.getExecutor(qr).query(sql, [userId]);
  }

  /**
   * Creates a new organization unit node.
   */
  async create(
    data: {
      orgUnitTypeId: number;
      parentOrgUnitId?: string | null;
      code: string;
      name: string;
      nameAr?: string | null;
      shortName?: string | null;
      description?: string | null;
      materializedPath: string;
      depth: number;
      costCenterCode?: string | null;
      oracleOrgCode?: string | null;
      emailAddress?: string | null;
      phoneNumber?: string | null;
      sortOrder?: number;
      effectiveFrom: string;
      createdBy?: string | null;
    },
    qr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const sql = `
      INSERT INTO org.OrgUnits (
        OrgUnitTypeId,
        ParentOrgUnitId,
        Code,
        Name,
        NameAr,
        ShortName,
        Description,
        MaterializedPath,
        Depth,
        CostCenterCode,
        OracleOrgCode,
        EmailAddress,
        PhoneNumber,
        SortOrder,
        EffectiveFrom,
        IsActive,
        IsDeleted,
        CreatedBy,
        CreatedAt
      )
      OUTPUT 
        INSERTED.OrgUnitId AS orgUnitId,
        INSERTED.OrgUnitTypeId AS orgUnitTypeId,
        INSERTED.ParentOrgUnitId AS parentOrgUnitId,
        INSERTED.Code AS code,
        INSERTED.Name AS name,
        INSERTED.NameAr AS nameAr,
        INSERTED.ShortName AS shortName,
        INSERTED.Description AS description,
        INSERTED.MaterializedPath AS materializedPath,
        INSERTED.Depth AS depth,
        INSERTED.CostCenterCode AS costCenterCode,
        INSERTED.ADObjectGuid AS adObjectGuid,
        INSERTED.ADDistinguishedName AS adDistinguishedName,
        INSERTED.OracleOrgCode AS oracleOrgCode,
        INSERTED.HeadUserId AS headUserId,
        INSERTED.EmailAddress AS emailAddress,
        INSERTED.PhoneNumber AS phoneNumber,
        INSERTED.SortOrder AS sortOrder,
        INSERTED.EffectiveFrom AS effectiveFrom,
        INSERTED.EffectiveTo AS effectiveTo,
        INSERTED.IsActive AS isActive,
        INSERTED.IsDeleted AS isDeleted,
        INSERTED.CreatedBy AS createdBy,
        INSERTED.CreatedAt AS createdAt,
        INSERTED.UpdatedBy AS updatedBy,
        INSERTED.UpdatedAt AS updatedAt,
        CONVERT(VARCHAR(34), CAST(INSERTED.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      VALUES (
        @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12, @13, @14, 1, 0, @15, SYSUTCDATETIME()
      );
    `;

    const params = [
      data.orgUnitTypeId,
      data.parentOrgUnitId ?? null,
      data.code,
      data.name,
      data.nameAr ?? null,
      data.shortName ?? null,
      data.description ?? null,
      data.materializedPath,
      data.depth,
      data.costCenterCode ?? null,
      data.oracleOrgCode ?? null,
      data.emailAddress ?? null,
      data.phoneNumber ?? null,
      data.sortOrder ?? 0,
      data.effectiveFrom,
      data.createdBy ?? null,
    ];

    const rows = await this.getExecutor(qr).query(sql, params);
    return rows[0];
  }

  /**
   * Updates attributes of an organization unit (never reparents).
   */
  async update(
    orgUnitId: string,
    data: {
      code?: string;
      name?: string;
      nameAr?: string | null;
      shortName?: string | null;
      description?: string | null;
      costCenterCode?: string | null;
      oracleOrgCode?: string | null;
      emailAddress?: string | null;
      phoneNumber?: string | null;
      sortOrder?: number;
      effectiveTo?: string | null;
      updatedBy?: string | null;
    },
    qr?: QueryRunner,
  ): Promise<IOrgUnit> {
    const sql = `
      UPDATE org.OrgUnits
      SET
        Code = COALESCE(@1, Code),
        Name = COALESCE(@2, Name),
        NameAr = CASE WHEN @3 IS NOT NULL THEN @3 ELSE NameAr END,
        ShortName = CASE WHEN @4 IS NOT NULL THEN @4 ELSE ShortName END,
        Description = CASE WHEN @5 IS NOT NULL THEN @5 ELSE Description END,
        CostCenterCode = CASE WHEN @6 IS NOT NULL THEN @6 ELSE CostCenterCode END,
        OracleOrgCode = CASE WHEN @7 IS NOT NULL THEN @7 ELSE OracleOrgCode END,
        EmailAddress = CASE WHEN @8 IS NOT NULL THEN @8 ELSE EmailAddress END,
        PhoneNumber = CASE WHEN @9 IS NOT NULL THEN @9 ELSE PhoneNumber END,
        SortOrder = COALESCE(@10, SortOrder),
        EffectiveTo = CASE WHEN @11 IS NOT NULL THEN @11 ELSE EffectiveTo END,
        UpdatedBy = @12,
        UpdatedAt = SYSUTCDATETIME()
      OUTPUT
        INSERTED.OrgUnitId AS orgUnitId,
        INSERTED.OrgUnitTypeId AS orgUnitTypeId,
        INSERTED.ParentOrgUnitId AS parentOrgUnitId,
        INSERTED.Code AS code,
        INSERTED.Name AS name,
        INSERTED.NameAr AS nameAr,
        INSERTED.ShortName AS shortName,
        INSERTED.Description AS description,
        INSERTED.MaterializedPath AS materializedPath,
        INSERTED.Depth AS depth,
        INSERTED.CostCenterCode AS costCenterCode,
        INSERTED.ADObjectGuid AS adObjectGuid,
        INSERTED.ADDistinguishedName AS adDistinguishedName,
        INSERTED.OracleOrgCode AS oracleOrgCode,
        INSERTED.HeadUserId AS headUserId,
        INSERTED.EmailAddress AS emailAddress,
        INSERTED.PhoneNumber AS phoneNumber,
        INSERTED.SortOrder AS sortOrder,
        INSERTED.EffectiveFrom AS effectiveFrom,
        INSERTED.EffectiveTo AS effectiveTo,
        INSERTED.IsActive AS isActive,
        INSERTED.IsDeleted AS isDeleted,
        INSERTED.CreatedBy AS createdBy,
        INSERTED.CreatedAt AS createdAt,
        INSERTED.UpdatedBy AS updatedBy,
        INSERTED.UpdatedAt AS updatedAt,
        CONVERT(VARCHAR(34), CAST(INSERTED.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      WHERE OrgUnitId = @0 AND IsDeleted = 0;
    `;

    const params = [
      orgUnitId,
      data.code ?? null,
      data.name ?? null,
      data.nameAr !== undefined ? data.nameAr : null,
      data.shortName !== undefined ? data.shortName : null,
      data.description !== undefined ? data.description : null,
      data.costCenterCode !== undefined ? data.costCenterCode : null,
      data.oracleOrgCode !== undefined ? data.oracleOrgCode : null,
      data.emailAddress !== undefined ? data.emailAddress : null,
      data.phoneNumber !== undefined ? data.phoneNumber : null,
      data.sortOrder ?? null,
      data.effectiveTo !== undefined ? data.effectiveTo : null,
      data.updatedBy ?? null,
    ];

    const rows = await this.getExecutor(qr).query(sql, params);
    return rows[0];
  }

  /**
   * §6.2 Reparents node, updates ParentOrgUnitId, and recomputes Depth across entire subtree.
   */
  async updateParentAndSubtreeDepth(
    nodeId: string,
    newParentId: string,
    actorUserId: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    // 1. Update direct parent
    const sqlAdjacency = `
      UPDATE org.OrgUnits
      SET ParentOrgUnitId = @1,
          UpdatedBy = @2,
          UpdatedAt = SYSUTCDATETIME()
      WHERE OrgUnitId = @0;
    `;
    await this.getExecutor(qr).query(sqlAdjacency, [
      nodeId,
      newParentId,
      actorUserId,
    ]);

    // 2. Recompute Depth for every node in the subtree from closure table (§6.2)
    const sqlDepth = `
      UPDATE u
      SET u.Depth = c.Depth
      FROM org.OrgUnits AS u
      INNER JOIN (
          SELECT cl.DescendantOrgUnitId, MAX(cl.Depth) AS Depth
          FROM org.OrgUnitClosure AS cl
          INNER JOIN org.OrgUnitClosure AS sub
                  ON sub.DescendantOrgUnitId = cl.DescendantOrgUnitId
          WHERE sub.AncestorOrgUnitId = @0
            AND cl.AncestorOrgUnitId IN (SELECT OrgUnitId FROM org.OrgUnits WHERE ParentOrgUnitId IS NULL)
          GROUP BY cl.DescendantOrgUnitId
      ) AS c ON c.DescendantOrgUnitId = u.OrgUnitId;
    `;
    await this.getExecutor(qr).query(sqlDepth, [nodeId]);
  }

  /**
   * §6.2 Rebuilds MaterializedPath for an entire subtree using recursive CTE.
   */
  async rebuildSubtreePaths(nodeId: string, qr?: QueryRunner): Promise<void> {
    const sql = `
      WITH Subtree AS (
          SELECT u.OrgUnitId,
                 u.ParentOrgUnitId,
                 CAST(p.MaterializedPath + REPLACE(CAST(u.OrgUnitId AS VARCHAR(36)), '-', '') + '/' AS VARCHAR(900)) AS NewPath
          FROM org.OrgUnits AS u
          INNER JOIN org.OrgUnits AS p ON p.OrgUnitId = u.ParentOrgUnitId
          WHERE u.OrgUnitId = @0

          UNION ALL

          SELECT c.OrgUnitId,
                 c.ParentOrgUnitId,
                 CAST(s.NewPath + REPLACE(CAST(c.OrgUnitId AS VARCHAR(36)), '-', '') + '/' AS VARCHAR(900))
          FROM org.OrgUnits AS c
          INNER JOIN Subtree AS s ON s.OrgUnitId = c.ParentOrgUnitId
          WHERE c.IsDeleted = 0
      )
      UPDATE u
      SET u.MaterializedPath = s.NewPath
      FROM org.OrgUnits AS u
      INNER JOIN Subtree AS s ON s.OrgUnitId = u.OrgUnitId
      OPTION (MAXRECURSION 100);
    `;
    await this.getExecutor(qr).query(sql, [nodeId]);
  }

  /**
   * Updates the denormalized primary HeadUserId on an org unit.
   */
  async updateHeadUser(
    orgUnitId: string,
    headUserId: string | null,
    actorUserId: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE org.OrgUnits
      SET HeadUserId = @1,
          UpdatedBy = @2,
          UpdatedAt = SYSUTCDATETIME()
      WHERE OrgUnitId = @0;
    `;
    await this.getExecutor(qr).query(sql, [orgUnitId, headUserId, actorUserId]);
  }

  /**
   * Updates active state of an org unit.
   */
  async setActiveStatus(
    orgUnitId: string,
    isActive: boolean,
    effectiveTo: string | null,
    actorUserId: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE org.OrgUnits
      SET IsActive = @1,
          EffectiveTo = CASE
            WHEN @1 = 1 THEN NULL
            WHEN @2 IS NOT NULL AND CAST(@2 AS DATE) >= EffectiveFrom THEN CAST(@2 AS DATE)
            ELSE EffectiveFrom
          END,
          UpdatedBy = @3,
          UpdatedAt = SYSUTCDATETIME()
      WHERE OrgUnitId = @0 AND IsDeleted = 0;
    `;
    await this.getExecutor(qr).query(sql, [
      orgUnitId,
      isActive ? 1 : 0,
      effectiveTo,
      actorUserId,
    ]);
  }

  /**
   * Soft deletes an org unit.
   */
  async softDelete(
    orgUnitId: string,
    deletedBy: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE org.OrgUnits
      SET IsDeleted = 1,
          IsActive = 0,
          DeletedBy = @1,
          DeletedAt = SYSUTCDATETIME()
      WHERE OrgUnitId = @0;
    `;
    await this.getExecutor(qr).query(sql, [orgUnitId, deletedBy]);
  }

  /**
   * §8.4 Finds nearest ancestor org unit with AllowsBudget = 1.
   */
  async findBudgetOwner(
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnit | null> {
    const sql = `
      SELECT TOP 1
        u.OrgUnitId AS orgUnitId,
        u.OrgUnitTypeId AS orgUnitTypeId,
        u.ParentOrgUnitId AS parentOrgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        u.ShortName AS shortName,
        u.Description AS description,
        u.MaterializedPath AS materializedPath,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        u.HeadUserId AS headUserId,
        u.SortOrder AS sortOrder,
        u.EffectiveFrom AS effectiveFrom,
        u.EffectiveTo AS effectiveTo,
        u.IsActive AS isActive,
        u.IsDeleted AS isDeleted,
        CONVERT(VARCHAR(34), CAST(u.RowVersion AS VARBINARY(8)), 1) AS rowVersion
      FROM org.OrgUnits u
      INNER JOIN org.OrgUnitTypes t ON t.OrgUnitTypeId = u.OrgUnitTypeId
      INNER JOIN org.OrgUnitClosure c ON c.AncestorOrgUnitId = u.OrgUnitId
      WHERE c.DescendantOrgUnitId = @0
        AND t.AllowsBudget = 1
        AND u.IsDeleted = 0
        AND u.IsActive = 1
      ORDER BY c.Depth ASC; -- Nearest ancestor first (smallest depth distance)
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Counts total matching records within caller's visible scope for export.
   */
  async countForExport(
    userId: string,
    filters: {
      orgUnitTypeId?: number;
      parentOrgUnitId?: string;
      search?: string;
      isActive?: boolean;
    },
    qr?: QueryRunner,
  ): Promise<number> {
    const sql = `
      SELECT COUNT(1) AS total
      FROM org.OrgUnits u
      INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.OrgUnitId
      WHERE u.IsDeleted = 0
        AND (@1 IS NULL OR u.OrgUnitTypeId = @1)
        AND (@2 IS NULL OR u.ParentOrgUnitId = @2)
        AND (@3 IS NULL OR (u.Code LIKE '%' + @3 + '%' OR u.Name LIKE '%' + @3 + '%'))
        AND (@4 IS NULL OR u.IsActive = @4);
    `;
    const rows = await this.getExecutor(qr).query(sql, [
      userId,
      filters.orgUnitTypeId ?? null,
      filters.parentOrgUnitId ?? null,
      filters.search ?? null,
      filters.isActive !== undefined ? (filters.isActive ? 1 : 0) : null,
    ]);
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Retrieves enriched org units dataset within caller's visible scope for Excel export.
   */
  async findForExport(
    userId: string,
    filters: {
      orgUnitTypeId?: number;
      parentOrgUnitId?: string;
      search?: string;
      isActive?: boolean;
    },
    qr?: QueryRunner,
  ): Promise<any[]> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.NameAr AS nameAr,
        t.Name AS typeName,
        t.Code AS typeCode,
        p.Code AS parentCode,
        p.Name AS parentName,
        u.Depth AS depth,
        u.CostCenterCode AS costCenterCode,
        CASE
          WHEN up.FirstName IS NOT NULL THEN CONCAT(up.FirstName, ' ', up.LastName)
          WHEN usr.Username IS NOT NULL THEN usr.Username
          ELSE NULL
        END AS headDisplayName,
        u.IsActive AS isActive,
        CONVERT(VARCHAR(10), u.EffectiveFrom, 120) AS effectiveFrom,
        CONVERT(VARCHAR(10), u.EffectiveTo, 120) AS effectiveTo
      FROM org.OrgUnits u
      INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.OrgUnitId
      INNER JOIN org.OrgUnitTypes t ON t.OrgUnitTypeId = u.OrgUnitTypeId
      LEFT JOIN org.OrgUnits p ON p.OrgUnitId = u.ParentOrgUnitId AND p.IsDeleted = 0
      LEFT JOIN auth.Users usr ON usr.UserID = u.HeadUserId
      LEFT JOIN auth.UserProfiles up ON up.UserID = usr.UserID
      WHERE u.IsDeleted = 0
        AND (@1 IS NULL OR u.OrgUnitTypeId = @1)
        AND (@2 IS NULL OR u.ParentOrgUnitId = @2)
        AND (@3 IS NULL OR (u.Code LIKE '%' + @3 + '%' OR u.Name LIKE '%' + @3 + '%'))
        AND (@4 IS NULL OR u.IsActive = @4)
      ORDER BY u.Depth ASC, u.SortOrder ASC, u.Name ASC;
    `;
    return this.getExecutor(qr).query(sql, [
      userId,
      filters.orgUnitTypeId ?? null,
      filters.parentOrgUnitId ?? null,
      filters.search ?? null,
      filters.isActive !== undefined ? (filters.isActive ? 1 : 0) : null,
    ]);
  }
}
