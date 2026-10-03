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
   * Retrieves all organization unit types.
   */
  async findAllTypes(qr?: QueryRunner): Promise<IOrgUnitType[]> {
    const sql = `
      SELECT
        unit_type_id AS unitTypeId,
        parent_unit_type_id AS parentUnitTypeId,
        org_unit_code AS orgUnitCode,
        org_unit_name AS orgUnitName,
        level AS level,
        allows_budget AS allowsBudget,
        allows_requisition AS allowsRequisition,
        is_active AS isActive
      FROM [masters].[tbl_Org_Unit_Types]
      ORDER BY level ASC, unit_type_id ASC;
    `;
    return this.getExecutor(qr).query(sql);
  }

  /**
   * Retrieves an organization unit type by its ID.
   */
  async findTypeById(
    unitTypeId: number,
    qr?: QueryRunner,
  ): Promise<IOrgUnitType | null> {
    const sql = `
      SELECT
        unit_type_id AS unitTypeId,
        parent_unit_type_id AS parentUnitTypeId,
        org_unit_code AS orgUnitCode,
        org_unit_name AS orgUnitName,
        level AS level,
        allows_budget AS allowsBudget,
        allows_requisition AS allowsRequisition,
        is_active AS isActive
      FROM [masters].[tbl_Org_Unit_Types]
      WHERE unit_type_id = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [unitTypeId]);
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
        unit_type_id AS unitTypeId,
        parent_unit_type_id AS parentUnitTypeId,
        org_unit_code AS orgUnitCode,
        org_unit_name AS orgUnitName,
        level AS level,
        allows_budget AS allowsBudget,
        allows_requisition AS allowsRequisition,
        is_active AS isActive
      FROM [masters].[tbl_Org_Unit_Types]
      WHERE org_unit_code = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [code]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Retrieves all active hierarchy rules (synthesized from parent_unit_type_id).
   */
  async findAllHierarchyRules(
    qr?: QueryRunner,
  ): Promise<IOrgUnitHierarchyRule[]> {
    const sql = `
      SELECT
        unit_type_id AS childOrgUnitTypeId,
        parent_unit_type_id AS parentOrgUnitTypeId,
        is_active AS isActive,
        NULL AS createdBy,
        SYSUTCDATETIME() AS createdAt
      FROM [masters].[tbl_Org_Unit_Types]
      WHERE parent_unit_type_id IS NOT NULL AND is_active = 1
      ORDER BY unit_type_id ASC, parent_unit_type_id ASC;
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
        unit_type_id AS childOrgUnitTypeId,
        parent_unit_type_id AS parentOrgUnitTypeId,
        is_active AS isActive,
        NULL AS createdBy,
        SYSUTCDATETIME() AS createdAt
      FROM [masters].[tbl_Org_Unit_Types]
      WHERE unit_type_id = @0 
        AND parent_unit_type_id = @1 
        AND is_active = 1;
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
        t.unit_type_id AS unitTypeId,
        t.parent_unit_type_id AS parentUnitTypeId,
        t.org_unit_code AS orgUnitCode,
        t.org_unit_name AS orgUnitName,
        t.level AS level,
        t.allows_budget AS allowsBudget,
        t.allows_requisition AS allowsRequisition,
        t.is_active AS isActive
      FROM [masters].[tbl_Org_Unit_Types] t
      INNER JOIN [masters].[tbl_Org_Unit_Types] c ON c.parent_unit_type_id = t.unit_type_id
      WHERE c.unit_type_id = @0
        AND c.is_active = 1
        AND t.is_active = 1
      ORDER BY t.level ASC, t.unit_type_id ASC;
    `;
    return this.getExecutor(qr).query(sql, [childTypeId]);
  }
}
