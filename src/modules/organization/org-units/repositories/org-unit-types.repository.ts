import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IOrgUnitHierarchyRule,
  IOrgUnitType,
} from '../interfaces/org-unit.interface';

@Injectable()
export class OrgUnitTypesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Retrieves all non-deleted organization unit types ordered by sort order and ID.
   */
  async findAllTypes(qr?: QueryRunner): Promise<IOrgUnitType[]> {
    const sql = `
      SELECT
        OrgUnitTypeId AS orgUnitTypeId,
        Code AS code,
        Name AS name,
        NameAr AS nameAr,
        Description AS description,
        CanonicalLevel AS canonicalLevel,
        ScopeLevelCode AS scopeLevelCode,
        AllowsBudget AS allowsBudget,
        AllowsRequisition AS allowsRequisition,
        AllowsManager AS allowsManager,
        IsRootType AS isRootType,
        SortOrder AS sortOrder,
        IsActive AS isActive,
        IsDeleted AS isDeleted,
        CreatedBy AS createdBy,
        CreatedAt AS createdAt,
        UpdatedBy AS updatedBy,
        UpdatedAt AS updatedAt
      FROM org.OrgUnitTypes
      WHERE IsDeleted = 0
      ORDER BY SortOrder ASC, OrgUnitTypeId ASC;
    `;
    return this.getExecutor(qr).query(sql);
  }

  /**
   * Retrieves an organization unit type by its ID.
   */
  async findTypeById(
    orgUnitTypeId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnitType | null> {
    const sql = `
      SELECT
        OrgUnitTypeId AS orgUnitTypeId,
        Code AS code,
        Name AS name,
        NameAr AS nameAr,
        Description AS description,
        CanonicalLevel AS canonicalLevel,
        ScopeLevelCode AS scopeLevelCode,
        AllowsBudget AS allowsBudget,
        AllowsRequisition AS allowsRequisition,
        AllowsManager AS allowsManager,
        IsRootType AS isRootType,
        SortOrder AS sortOrder,
        IsActive AS isActive,
        IsDeleted AS isDeleted,
        CreatedBy AS createdBy,
        CreatedAt AS createdAt,
        UpdatedBy AS updatedBy,
        UpdatedAt AS updatedAt
      FROM org.OrgUnitTypes
      WHERE OrgUnitTypeId = @0 AND IsDeleted = 0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitTypeId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Retrieves an organization unit type by its unique Code.
   */
  async findTypeByCode(
    code: string,
    qr?: QueryRunner,
  ): Promise<IOrgUnitType | null> {
    const sql = `
      SELECT
        OrgUnitTypeId AS orgUnitTypeId,
        Code AS code,
        Name AS name,
        NameAr AS nameAr,
        Description AS description,
        CanonicalLevel AS canonicalLevel,
        ScopeLevelCode AS scopeLevelCode,
        AllowsBudget AS allowsBudget,
        AllowsRequisition AS allowsRequisition,
        AllowsManager AS allowsManager,
        IsRootType AS isRootType,
        SortOrder AS sortOrder,
        IsActive AS isActive,
        IsDeleted AS isDeleted,
        CreatedBy AS createdBy,
        CreatedAt AS createdAt,
        UpdatedBy AS updatedBy,
        UpdatedAt AS updatedAt
      FROM org.OrgUnitTypes
      WHERE Code = @0 AND IsDeleted = 0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [code]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Retrieves all active hierarchy rules specifying permitted (child, parent) type pairs.
   */
  async findAllHierarchyRules(
    qr?: QueryRunner,
  ): Promise<IOrgUnitHierarchyRule[]> {
    const sql = `
      SELECT
        ChildOrgUnitTypeId AS childOrgUnitTypeId,
        ParentOrgUnitTypeId AS parentOrgUnitTypeId,
        IsActive AS isActive,
        CreatedBy AS createdBy,
        CreatedAt AS createdAt
      FROM org.OrgUnitTypeHierarchyRules
      WHERE IsActive = 1
      ORDER BY ChildOrgUnitTypeId ASC, ParentOrgUnitTypeId ASC;
    `;
    return this.getExecutor(qr).query(sql);
  }

  /**
   * Retrieves a specific hierarchy rule.
   */
  async findHierarchyRule(
    childTypeId: number,
    parentTypeId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnitHierarchyRule | null> {
    const sql = `
      SELECT
        ChildOrgUnitTypeId AS childOrgUnitTypeId,
        ParentOrgUnitTypeId AS parentOrgUnitTypeId,
        IsActive AS isActive,
        CreatedBy AS createdBy,
        CreatedAt AS createdAt
      FROM org.OrgUnitTypeHierarchyRules
      WHERE ChildOrgUnitTypeId = @0 
        AND ParentOrgUnitTypeId = @1 
        AND IsActive = 1;
    `;
    const rows = await this.getExecutor(qr).query(sql, [
      childTypeId,
      parentTypeId,
    ]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Finds all permitted parent OrgUnitTypes for a given child unit type.
   */
  async findAllowedParentTypes(
    childTypeId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnitType[]> {
    const sql = `
      SELECT
        t.OrgUnitTypeId AS orgUnitTypeId,
        t.Code AS code,
        t.Name AS name,
        t.NameAr AS nameAr,
        t.Description AS description,
        t.CanonicalLevel AS canonicalLevel,
        t.ScopeLevelCode AS scopeLevelCode,
        t.AllowsBudget AS allowsBudget,
        t.AllowsRequisition AS allowsRequisition,
        t.AllowsManager AS allowsManager,
        t.IsRootType AS isRootType,
        t.SortOrder AS sortOrder,
        t.IsActive AS isActive,
        t.IsDeleted AS isDeleted,
        t.CreatedBy AS createdBy,
        t.CreatedAt AS createdAt,
        t.UpdatedBy AS updatedBy,
        t.UpdatedAt AS updatedAt
      FROM org.OrgUnitTypes t
      INNER JOIN org.OrgUnitTypeHierarchyRules r 
              ON r.ParentOrgUnitTypeId = t.OrgUnitTypeId
      WHERE r.ChildOrgUnitTypeId = @0
        AND r.IsActive = 1
        AND t.IsDeleted = 0
        AND t.IsActive = 1
      ORDER BY t.SortOrder ASC, t.OrgUnitTypeId ASC;
    `;
    return this.getExecutor(qr).query(sql, [childTypeId]);
  }
}
