import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IUserOrgScope,
  IVisibleOrgUnitResult,
} from '../interfaces/org-scope.interface';

@Injectable()
export class OrgScopeRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Retrieves user scope assignments from auth.UserOrganizationScopes.
   */
  async getUserScopes(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IUserOrgScope[]> {
    const sql = `
      SELECT
        s.UserOrganizationScopeID AS userOrganizationScopeId,
        s.UserID AS userId,
        s.ScopeDefinitionID AS scopeDefinitionId,
        d.ScopeCode AS scopeCode,
        d.ScopeName AS scopeName,
        s.OrgUnitId AS orgUnitId,
        s.OrganizationID AS organizationId,
        s.BusinessUnitID AS businessUnitId,
        s.DepartmentID AS departmentId,
        s.SectionID AS sectionId
      FROM auth.UserOrganizationScopes s
      LEFT JOIN auth.ScopeDefinitions d ON d.ScopeDefinitionID = s.ScopeDefinitionID
      WHERE s.UserID = @0;
    `;
    return this.getExecutor(qr).query(sql, [userId]);
  }

  /**
   * Returns all OrgUnitIds visible to a given user via org.fn_VisibleOrgUnits.
   */
  async getVisibleOrgUnitIds(
    userId: string,
    qr?: QueryRunner,
  ): Promise<string[]> {
    const sql = `
      SELECT OrgUnitId AS id
      FROM org.fn_VisibleOrgUnits(@0);
    `;
    const rows = await this.getExecutor(qr).query(sql, [userId]);
    return rows.map((r: { id: string }) => r.id);
  }

  /**
   * Returns visible org units for a user.
   */
  async getVisibleOrgUnits(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IVisibleOrgUnitResult[]> {
    const sql = `
      SELECT
        u.OrgUnitId AS orgUnitId,
        u.Code AS code,
        u.Name AS name,
        u.OrgUnitTypeId AS orgUnitTypeId
      FROM org.OrgUnits u
      INNER JOIN org.fn_VisibleOrgUnits(@0) v ON v.OrgUnitId = u.OrgUnitId
      WHERE u.IsDeleted = 0
      ORDER BY u.Depth ASC, u.SortOrder ASC, u.Name ASC;
    `;
    return this.getExecutor(qr).query(sql, [userId]);
  }

  /**
   * Checks whether a specific org unit is visible to a user.
   */
  async isOrgUnitVisible(
    userId: string,
    orgUnitId: string,
    qr?: QueryRunner,
  ): Promise<boolean> {
    const sql = `
      SELECT 1 AS isVisible
      FROM org.fn_VisibleOrgUnits(@0)
      WHERE OrgUnitId = @1;
    `;
    const rows = await this.getExecutor(qr).query(sql, [userId, orgUnitId]);
    return rows.length > 0;
  }
}
