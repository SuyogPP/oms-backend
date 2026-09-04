import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IUserScopeAssignment,
  IAssignScopeData,
} from '../interfaces/user-assignments.interface';

@Injectable()
export class UserScopesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Retrieves all scope assignments for a user.
   */
  async findByUserId(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IUserScopeAssignment[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          s.UserOrganizationScopeID AS userOrganizationScopeId,
          s.UserID AS userId,
          s.ScopeDefinitionID AS scopeDefinitionId,
          sd.ScopeCode AS scopeCode,
          sd.ScopeName AS scopeName,
          COALESCE(s.DepartmentID, s.BusinessUnitID, s.SectionID, s.OrganizationID) AS orgUnitId,
          s.OrganizationID AS organizationId,
          s.BusinessUnitID AS businessUnitId,
          s.DepartmentID AS departmentId,
          s.SectionID AS sectionId,
          ou.Name AS orgUnitName,
          ou.Code AS orgUnitCode,
          CAST(NULL AS DATETIME2) AS effectiveFrom,
          CAST(NULL AS DATETIME2) AS effectiveTo,
          CAST(1 AS BIT) AS isActive
      FROM [auth].[UserOrganizationScopes] s
      INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
      LEFT JOIN [org].[OrgUnits] ou ON ou.OrgUnitId = COALESCE(s.DepartmentID, s.BusinessUnitID, s.SectionID, s.OrganizationID)
      WHERE s.UserID = @0;
      `,
      [userId],
    );

    return rows.map((r: any) => ({
      userOrganizationScopeId: r.userOrganizationScopeId,
      userId: r.userId,
      scopeDefinitionId: r.scopeDefinitionId,
      scopeCode: r.scopeCode,
      scopeName: r.scopeName,
      orgUnitId: r.orgUnitId,
      organizationId: r.organizationId,
      businessUnitId: r.businessUnitId,
      departmentId: r.departmentId,
      sectionId: r.sectionId,
      orgUnitName: r.orgUnitName,
      orgUnitCode: r.orgUnitCode,
      effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom) : null,
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
      isActive:
        r.isActive !== undefined
          ? r.isActive === 1 || r.isActive === true
          : true,
    }));
  }

  /**
   * Retrieves active temporal scope assignments for a user.
   */
  async findActiveByUserId(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IUserScopeAssignment[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          s.UserOrganizationScopeID AS userOrganizationScopeId,
          s.UserID AS userId,
          s.ScopeDefinitionID AS scopeDefinitionId,
          sd.ScopeCode AS scopeCode,
          sd.ScopeName AS scopeName,
          COALESCE(s.DepartmentID, s.BusinessUnitID, s.SectionID, s.OrganizationID) AS orgUnitId,
          s.OrganizationID AS organizationId,
          s.BusinessUnitID AS businessUnitId,
          s.DepartmentID AS departmentId,
          s.SectionID AS sectionId,
          ou.Name AS orgUnitName,
          ou.Code AS orgUnitCode,
          CAST(NULL AS DATETIME2) AS effectiveFrom,
          CAST(NULL AS DATETIME2) AS effectiveTo,
          CAST(1 AS BIT) AS isActive
      FROM [auth].[UserOrganizationScopes] s
      INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
      LEFT JOIN [org].[OrgUnits] ou ON ou.OrgUnitId = COALESCE(s.DepartmentID, s.BusinessUnitID, s.SectionID, s.OrganizationID)
      WHERE s.UserID = @0;
      `,
      [userId],
    );

    return rows.map((r: any) => ({
      userOrganizationScopeId: r.userOrganizationScopeId,
      userId: r.userId,
      scopeDefinitionId: r.scopeDefinitionId,
      scopeCode: r.scopeCode,
      scopeName: r.scopeName,
      orgUnitId: r.orgUnitId,
      organizationId: r.organizationId,
      businessUnitId: r.businessUnitId,
      departmentId: r.departmentId,
      sectionId: r.sectionId,
      orgUnitName: r.orgUnitName,
      orgUnitCode: r.orgUnitCode,
      effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom) : null,
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
      isActive:
        r.isActive !== undefined
          ? r.isActive === 1 || r.isActive === true
          : true,
    }));
  }

  /**
   * Finds a scope assignment by ID.
   */
  async findById(
    userOrganizationScopeId: string,
    qr?: QueryRunner,
  ): Promise<IUserScopeAssignment | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          s.UserOrganizationScopeID AS userOrganizationScopeId,
          s.UserID AS userId,
          s.ScopeDefinitionID AS scopeDefinitionId,
          sd.ScopeCode AS scopeCode,
          sd.ScopeName AS scopeName,
          COALESCE(s.DepartmentID, s.BusinessUnitID, s.SectionID, s.OrganizationID) AS orgUnitId,
          s.OrganizationID AS organizationId,
          s.BusinessUnitID AS businessUnitId,
          s.DepartmentID AS departmentId,
          s.SectionID AS sectionId,
          ou.Name AS orgUnitName,
          ou.Code AS orgUnitCode,
          CAST(NULL AS DATETIME2) AS effectiveFrom,
          CAST(NULL AS DATETIME2) AS effectiveTo,
          CAST(1 AS BIT) AS isActive
      FROM [auth].[UserOrganizationScopes] s
      INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
      LEFT JOIN [org].[OrgUnits] ou ON ou.OrgUnitId = COALESCE(s.DepartmentID, s.BusinessUnitID, s.SectionID, s.OrganizationID)
      WHERE s.UserOrganizationScopeID = @0;
      `,
      [userOrganizationScopeId],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      userOrganizationScopeId: r.userOrganizationScopeId,
      userId: r.userId,
      scopeDefinitionId: r.scopeDefinitionId,
      scopeCode: r.scopeCode,
      scopeName: r.scopeName,
      orgUnitId: r.orgUnitId,
      organizationId: r.organizationId,
      businessUnitId: r.businessUnitId,
      departmentId: r.departmentId,
      sectionId: r.sectionId,
      orgUnitName: r.orgUnitName,
      orgUnitCode: r.orgUnitCode,
      effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom) : null,
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
      isActive:
        r.isActive !== undefined
          ? r.isActive === 1 || r.isActive === true
          : true,
    };
  }

  /**
   * Assigns an organizational scope to a user.
   */
  async assignScope(data: IAssignScopeData, qr?: QueryRunner): Promise<string> {
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].[UserOrganizationScopes] (
          UserOrganizationScopeID,
          UserID,
          ScopeDefinitionID,
          OrganizationID,
          BusinessUnitID,
          DepartmentID,
          SectionID
      )
      OUTPUT INSERTED.UserOrganizationScopeID AS userOrganizationScopeId
      VALUES (
          NEWID(),
          @0,
          @1,
          @2,
          @3,
          @4,
          @5
      );
      `,
      [
        data.userId,
        data.scopeDefinitionId,
        data.organizationId || null,
        data.businessUnitId || null,
        data.departmentId || null,
        data.sectionId || null,
      ],
    );

    return rows[0].userOrganizationScopeId;
  }

  /**
   * Revokes a scope assignment.
   */
  async revokeScope(
    userOrganizationScopeId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      DELETE FROM [auth].[UserOrganizationScopes]
      WHERE UserOrganizationScopeID = @0;
      `,
      [userOrganizationScopeId],
    );
  }

  /**
   * Counts active scope assignments for a user (used for S8 self-removal check).
   */
  async countActiveByUserId(userId: string, qr?: QueryRunner): Promise<number> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT COUNT(*) AS total
      FROM [auth].[UserOrganizationScopes]
      WHERE UserID = @0;
      `,
      [userId],
    );

    return rows[0]?.total ? Number(rows[0].total) : 0;
  }

  /**
   * Helper returning the count of active org units a proposed scope would grant access to.
   */
  async countUnitsInScope(
    scopeCode: string,
    orgUnitId?: string | null,
    qr?: QueryRunner,
  ): Promise<number> {
    if (scopeCode === 'GLOBAL' || !orgUnitId) {
      const rows = await this.getExecutor(qr).query(
        `
        SELECT COUNT(*) AS total
        FROM [org].[OrgUnits]
        WHERE IsDeleted = 0 AND IsActive = 1;
        `,
      );
      return rows[0]?.total ? Number(rows[0].total) : 0;
    }

    const rows = await this.getExecutor(qr).query(
      `
      SELECT COUNT(DISTINCT c.DescendantOrgUnitId) AS total
      FROM [org].[OrgUnitClosure] c
      INNER JOIN [org].[OrgUnits] u ON u.OrgUnitId = c.DescendantOrgUnitId
      WHERE c.AncestorOrgUnitId = @0
        AND u.IsDeleted = 0
        AND u.IsActive = 1;
      `,
      [orgUnitId],
    );

    return rows[0]?.total ? Number(rows[0].total) : 0;
  }
}
