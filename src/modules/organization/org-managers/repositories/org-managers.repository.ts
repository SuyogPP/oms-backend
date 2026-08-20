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
        m.ManagerRoleCode AS managerRoleCode,
        m.IsPrimary AS isPrimary,
        m.EffectiveFrom AS effectiveFrom,
        m.EffectiveTo AS effectiveTo,
        m.AssignmentReason AS assignmentReason,
        m.IsActive AS isActive,
        m.IsDeleted AS isDeleted,
        m.CreatedBy AS createdBy,
        m.CreatedAt AS createdAt,
        m.UpdatedBy AS updatedBy,
        m.UpdatedAt AS updatedAt,
        u.Username AS username,
        u.Email AS userEmail,
        CONCAT(p.FirstName, ' ', p.LastName) AS userDisplayName,
        ou.Name AS orgUnitName,
        ou.Code AS orgUnitCode
      FROM org.OrgUnitManagers m
      INNER JOIN auth.Users u ON u.UserID = m.UserId
      LEFT JOIN auth.UserProfiles p ON p.UserID = u.UserID
      INNER JOIN org.OrgUnits ou ON ou.OrgUnitId = m.OrgUnitId
      WHERE m.OrgUnitId = @0 AND m.IsDeleted = 0
      ORDER BY m.EffectiveFrom DESC, m.IsPrimary DESC, m.CreatedAt DESC;
    `;
    return this.getExecutor(qr).query(sql, [orgUnitId]);
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
        m.ManagerRoleCode AS managerRoleCode,
        m.IsPrimary AS isPrimary,
        m.EffectiveFrom AS effectiveFrom,
        m.EffectiveTo AS effectiveTo,
        m.AssignmentReason AS assignmentReason,
        m.IsActive AS isActive,
        m.IsDeleted AS isDeleted,
        m.CreatedBy AS createdBy,
        m.CreatedAt AS createdAt,
        m.UpdatedBy AS updatedBy,
        m.UpdatedAt AS updatedAt,
        u.Username AS username,
        u.Email AS userEmail,
        CONCAT(p.FirstName, ' ', p.LastName) AS userDisplayName,
        ou.Name AS orgUnitName,
        ou.Code AS orgUnitCode
      FROM org.OrgUnitManagers m
      INNER JOIN auth.Users u ON u.UserID = m.UserId
      LEFT JOIN auth.UserProfiles p ON p.UserID = u.UserID
      INNER JOIN org.OrgUnits ou ON ou.OrgUnitId = m.OrgUnitId
      WHERE m.OrgUnitId = @0
        AND m.ManagerRoleCode = '${ORG_MANAGER_ROLES.HEAD}'
        AND m.IsPrimary = 1
        AND m.IsActive = 1
        AND m.IsDeleted = 0
        AND m.EffectiveFrom <= CAST(@1 AS DATE)
        AND (m.EffectiveTo IS NULL OR m.EffectiveTo >= CAST(@1 AS DATE))
      ORDER BY m.EffectiveFrom DESC;
    `;
    const rows = await this.getExecutor(qr).query(sql, [orgUnitId, dateParam]);
    return rows.length > 0 ? rows[0] : null;
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
        m.ManagerRoleCode AS managerRoleCode,
        m.IsPrimary AS isPrimary,
        m.EffectiveFrom AS effectiveFrom,
        m.EffectiveTo AS effectiveTo,
        m.AssignmentReason AS assignmentReason,
        m.IsActive AS isActive,
        m.IsDeleted AS isDeleted,
        m.CreatedBy AS createdBy,
        m.CreatedAt AS createdAt,
        m.UpdatedBy AS updatedBy,
        m.UpdatedAt AS updatedAt,
        u.Username AS username,
        u.Email AS userEmail,
        CONCAT(p.FirstName, ' ', p.LastName) AS userDisplayName,
        ou.Name AS orgUnitName,
        ou.Code AS orgUnitCode
      FROM org.OrgUnitManagers m
      INNER JOIN auth.Users u ON u.UserID = m.UserId
      LEFT JOIN auth.UserProfiles p ON p.UserID = u.UserID
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
        m.ManagerRoleCode AS managerRoleCode,
        m.IsPrimary AS isPrimary,
        m.EffectiveFrom AS effectiveFrom,
        m.EffectiveTo AS effectiveTo,
        m.AssignmentReason AS assignmentReason,
        m.IsActive AS isActive,
        m.IsDeleted AS isDeleted,
        m.CreatedBy AS createdBy,
        m.CreatedAt AS createdAt,
        m.UpdatedBy AS updatedBy,
        m.UpdatedAt AS updatedAt,
        u.Username AS username,
        u.Email AS userEmail,
        CONCAT(p.FirstName, ' ', p.LastName) AS userDisplayName,
        ou.Name AS orgUnitName,
        ou.Code AS orgUnitCode
      FROM org.OrgUnitManagers m
      INNER JOIN auth.Users u ON u.UserID = m.UserId
      LEFT JOIN auth.UserProfiles p ON p.UserID = u.UserID
      INNER JOIN org.OrgUnits ou ON ou.OrgUnitId = m.OrgUnitId
      WHERE m.UserId = @0 AND m.IsDeleted = 0 AND ou.IsDeleted = 0
      ORDER BY m.EffectiveFrom DESC, m.IsActive DESC;
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
        INSERTED.ManagerRoleCode AS managerRoleCode,
        INSERTED.IsPrimary AS isPrimary,
        INSERTED.EffectiveFrom AS effectiveFrom,
        INSERTED.EffectiveTo AS effectiveTo,
        INSERTED.AssignmentReason AS assignmentReason,
        INSERTED.IsActive AS isActive,
        INSERTED.IsDeleted AS isDeleted,
        INSERTED.CreatedBy AS createdBy,
        INSERTED.CreatedAt AS createdAt,
        INSERTED.UpdatedBy AS updatedBy,
        INSERTED.UpdatedAt AS updatedAt
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
        INSERTED.ManagerRoleCode AS managerRoleCode,
        INSERTED.IsPrimary AS isPrimary,
        INSERTED.EffectiveFrom AS effectiveFrom,
        INSERTED.EffectiveTo AS effectiveTo,
        INSERTED.AssignmentReason AS assignmentReason,
        INSERTED.IsActive AS isActive,
        INSERTED.IsDeleted AS isDeleted,
        INSERTED.CreatedBy AS createdBy,
        INSERTED.CreatedAt AS createdAt,
        INSERTED.UpdatedBy AS updatedBy,
        INSERTED.UpdatedAt AS updatedAt
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
        AND ManagerRoleCode = '${ORG_MANAGER_ROLES.HEAD}'
        AND IsPrimary = 1
        AND IsDeleted = 0
        AND IsActive = 1
        AND (EffectiveTo IS NULL OR EffectiveTo >= CAST(@1 AS DATE));
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
        CONCAT(p.FirstName, ' ', p.LastName) AS headDisplayName,
        usr.Email AS headEmail,
        m.ManagerRoleCode AS managerRoleCode
      FROM org.OrgUnitClosure c
      INNER JOIN org.OrgUnits u ON u.OrgUnitId = c.AncestorOrgUnitId
      LEFT JOIN org.OrgUnitManagers m
             ON m.OrgUnitId = u.OrgUnitId
            AND m.ManagerRoleCode = '${ORG_MANAGER_ROLES.HEAD}'
            AND m.IsPrimary = 1
            AND m.IsActive = 1
            AND m.IsDeleted = 0
            AND m.EffectiveFrom <= @1
            AND (m.EffectiveTo IS NULL OR m.EffectiveTo >= @1)
      LEFT JOIN auth.Users usr ON usr.UserID = m.UserId
      LEFT JOIN auth.UserProfiles p ON p.UserID = usr.UserID
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
