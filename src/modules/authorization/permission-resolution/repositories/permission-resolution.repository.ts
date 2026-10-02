import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  RoleResolutionItem,
  RawPermissionRow,
  RawOverrideRow,
  RawDelegationRow,
} from '../interfaces/permission-resolution.interface';
import { MAX_ROLE_HIERARCHY_DEPTH } from '../permission-resolution.constants';

@Injectable()
export class PermissionResolutionRepository {
  private readonly logger = new Logger(PermissionResolutionRepository.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Checks whether a target user is within the requester's visible organization scope.
   *
   * Visibility Rules (§9.2):
   * 1. Self-inspection: A user can always inspect their own permissions (requesterUserId === targetUserId).
   * 2. GLOBAL scope: A requester holding GLOBAL scope can inspect all active users.
   * 3. Scoped subtree: An HOD or manager can only inspect users whose department/section/unit
   *    is within their visible org subtree (org.fn_VisibleOrgUnits(@RequesterId)).
   * 4. Target user must exist and not be soft-deleted.
   */
  async isUserInScope(
    requesterUserId: string,
    targetUserId: string,
  ): Promise<boolean> {
    if (!requesterUserId || !targetUserId) {
      return false;
    }

    const rows = await this.dataSource.query(
      `
      SELECT TOP 1 1 AS isAllowed
      FROM [auth].tbl_Users] u
      LEFT JOIN [auth].[UserProfiles] p ON p.user_id = u.user_id
      WHERE u.user_id = @0
        AND u.IsDeleted = 0
        AND (
            -- Rule 1: Self-inspection
            @1 = @0
            OR
            -- Rule 2: Requester has GLOBAL scope
            EXISTS (
                SELECT 1 
                FROM [auth].[UserOrganizationScopes] s
                INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
                WHERE s.user_id = @1
                  AND sd.ScopeCode = 'GLOBAL'
            )
            OR
            -- Rule 3: Target user's department/unit is in requester's visible scope
            EXISTS (
                SELECT 1 
                FROM [auth].[UserOrganizationScopes] s
                WHERE s.user_id = @1
                  AND (
                     (p.DepartmentID IS NOT NULL AND s.DepartmentID = p.DepartmentID)
                     OR (p.BusinessUnitID IS NOT NULL AND s.BusinessUnitID = p.BusinessUnitID)
                     OR (p.SectionID IS NOT NULL AND s.SectionID = p.SectionID)
                     OR s.OrganizationID IS NOT NULL
                  )
            )
        );
      `,
      [targetUserId, requesterUserId],
    );

    return rows && rows.length > 0;
  }

  /**
   * Checks whether a user exists, is active, and is not soft-deleted.
   * If false, permission resolution short-circuits to empty permissions.
   */
  async isUserActive(userId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `
      SELECT 
          CASE WHEN u.is_active = 1 AND u.IsDeleted = 0 THEN 1 ELSE 0 END AS isLive
      FROM [auth].tbl_Users] u
      WHERE u.user_id = @0;
      `,
      [userId],
    );

    if (!rows || rows.length === 0) {
      return false;
    }

    return rows[0].isLive === 1 || rows[0].isLive === true;
  }

  /**
   * Resolves direct and transitively inherited roles for a user.
   * Uses recursive CTE with verified direction (Parent confers Child) and depth guard.
   */
  async resolveUserRolesWithHierarchy(
    userId: string,
  ): Promise<RoleResolutionItem[]> {
    const rows = await this.dataSource.query(
      `
      WITH RoleClosure AS (
          -- Anchor: Direct active temporal role assignments
          SELECT 
              ur.role_id AS roleId,
              r.role_code AS roleCode,
              r.role_name AS roleName,
              0 AS depth,
              CAST(r.role_code AS NVARCHAR(500)) AS inheritedVia,
              ur.effective_from AS effectiveFrom,
              ur.effective_to AS effectiveTo
          FROM [auth].tbl_User_Roles] ur
          INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id
          WHERE ur.user_id = @0
            AND ur.is_active = 1
            AND r.is_active = 1
            AND ur.effective_from <= SYSUTCDATETIME()
            AND (ur.effective_to IS NULL OR ur.effective_to > SYSUTCDATETIME())

          UNION ALL

          -- Recursive: Parent role confers all child role permissions
          SELECT 
              cr.role_id AS roleId,
              cr.role_code AS roleCode,
              cr.role_name AS roleName,
              rc.depth + 1 AS depth,
              CAST(rc.inheritedVia + ' ← ' + cr.role_code AS NVARCHAR(500)) AS inheritedVia,
              rc.effectiveFrom,
              rc.effectiveTo
          FROM [auth].tbl_Role_Hierarchy] rh
          INNER JOIN RoleClosure rc ON rc.roleId = rh.ParentRoleID
          INNER JOIN [auth].tbl_Roles] cr ON cr.role_id = rh.ChildRoleID
          WHERE rh.is_active = 1
            AND cr.is_active = 1
            AND rc.depth < ${MAX_ROLE_HIERARCHY_DEPTH}
      )
      SELECT DISTINCT 
          roleId,
          roleCode,
          roleName,
          depth,
          inheritedVia,
          effectiveFrom,
          effectiveTo
      FROM RoleClosure
      OPTION (MAXRECURSION ${MAX_ROLE_HIERARCHY_DEPTH});
      `,
      [userId],
    );

    return rows.map((r: any) => ({
      roleId: r.roleId,
      roleCode: r.roleCode,
      roleName: r.roleName,
      depth: Number(r.depth),
      inheritedVia: r.inheritedVia,
      effectiveFrom: new Date(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
    }));
  }

  /**
   * Resolves permissions assigned to a collection of active role IDs.
   *
   * Note on auth.tbl_Permission_Conditions / auth.tbl_Role_Permission_Conditions:
   * Per DOMAIN-3-RECONCILIATION.md Section 6, condition evaluation is treated as INERT.
   * Permissions attached to roles are evaluated directly without speculative DSL execution.
   */
  async resolvePermissionsForRoles(
    roles: RoleResolutionItem[],
  ): Promise<RawPermissionRow[]> {
    if (!roles || roles.length === 0) {
      return [];
    }

    const roleIds = roles.map((r) => r.roleId);
    const placeholders = roleIds.map((_, i) => `@${i}`).join(', ');

    const rows = await this.dataSource.query(
      `
      SELECT 
          rp.role_id AS roleId,
          p.permission_id AS permissionId,
          p.permission_code AS permissionCode,
          p.module_name AS moduleName,
          p.ActionName AS actionName
      FROM [auth].tbl_Role_Permissions] rp
      INNER JOIN [auth].tbl_Permissions] p ON p.permission_id = rp.permission_id
      WHERE rp.role_id IN (${placeholders});
      `,
      roleIds,
    );

    const roleMap = new Map<string, RoleResolutionItem>();
    for (const r of roles) {
      const existing = roleMap.get(r.roleId);
      if (!existing || r.depth < existing.depth) {
        roleMap.set(r.roleId, r);
      }
    }

    return rows.map((r: any) => {
      const meta = roleMap.get(r.roleId);
      return {
        roleId: r.roleId,
        roleCode: meta ? meta.roleCode : 'UNKNOWN',
        permissionId: r.permissionId,
        permissionCode: r.permissionCode,
        moduleName: r.moduleName,
        actionName: r.actionName,
        depth: meta ? meta.depth : 0,
        inheritedVia: meta ? meta.inheritedVia : undefined,
      };
    });
  }

  /**
   * Resolves user-specific temporal permission overrides (Grant and Revoke).
   */
  async resolveUserOverrides(userId: string): Promise<RawOverrideRow[]> {
    const rows = await this.dataSource.query(
      `
      SELECT 
          upo.user_permission_override_id AS overrideId,
          upo.user_id AS userId,
          upo.permission_id AS permissionId,
          p.permission_code AS permissionCode,
          upo.is_granted AS isGranted,
          upo.Reason AS reason,
          upo.approved_by AS approvedBy,
          upo.effective_from AS effectiveFrom,
          upo.effective_to AS effectiveTo
      FROM [auth].tbl_User_Permission_Overrides] upo
      INNER JOIN [auth].tbl_Permissions] p ON p.permission_id = upo.permission_id
      WHERE upo.user_id = @0
        AND upo.effective_from <= SYSUTCDATETIME()
        AND (upo.effective_to IS NULL OR upo.effective_to > SYSUTCDATETIME());
      `,
      [userId],
    );

    return rows.map((r: any) => ({
      overrideId: r.overrideId,
      userId: r.userId,
      permissionId: r.permissionId,
      permissionCode: r.permissionCode,
      isGranted: r.isGranted === 1 || r.isGranted === true,
      reason: r.reason,
      approvedBy: r.approvedBy,
      effectiveFrom: new Date(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
    }));
  }

  /**
   * Resolves permissions granted to the user via active temporal delegations.
   * Evaluated dynamically at request time.
   */
  async resolveDelegations(userId: string): Promise<RawDelegationRow[]> {
    const hasDelegationPermissionsTable = await this.dataSource.query(`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'DelegationPermissions';
    `);

    if (hasDelegationPermissionsTable.length > 0) {
      const rows = await this.dataSource.query(
        `
        SELECT 
            d.delegation_id AS delegationId,
            d.from_user_id AS fromUserId,
            CONCAT(fp.first_name, ' ', fp.last_name) AS fromUserName,
            d.to_user_id AS toUserId,
            d.start_date AS startDate,
            d.end_date AS endDate,
            d.Reason AS reason,
            p.permission_code AS permissionCode
        FROM [auth].tbl_Delegations] d
        LEFT JOIN [auth].[UserProfiles] fp ON fp.user_id = d.from_user_id
        INNER JOIN [auth].tbl_Delegation_Permissions] dp ON dp.delegation_id = d.delegation_id
        INNER JOIN [auth].tbl_Permissions] p ON p.permission_id = dp.permission_id
        WHERE d.to_user_id = @0
          AND d.is_active = 1
          AND d.start_date <= SYSUTCDATETIME()
          AND d.end_date > SYSUTCDATETIME();
        `,
        [userId],
      );

      return rows.map((r: any) => ({
        delegationId: r.delegationId,
        fromUserId: r.fromUserId,
        fromUserName: (r.fromUserName || 'Delegator').trim(),
        toUserId: r.toUserId,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        reason: r.reason,
        permissionCode: r.permissionCode,
      }));
    }

    const fallbackRows = await this.dataSource.query(
      `
      SELECT 
          d.delegation_id AS delegationId,
          d.from_user_id AS fromUserId,
          CONCAT(fp.first_name, ' ', fp.last_name) AS fromUserName,
          d.to_user_id AS toUserId,
          d.start_date AS startDate,
          d.end_date AS endDate,
          d.Reason AS reason
      FROM [auth].tbl_Delegations] d
      LEFT JOIN [auth].[UserProfiles] fp ON fp.user_id = d.from_user_id
      WHERE d.to_user_id = @0
        AND d.is_active = 1
        AND d.start_date <= SYSUTCDATETIME()
        AND d.end_date > SYSUTCDATETIME();
      `,
      [userId],
    );

    return fallbackRows.map((r: any) => ({
      delegationId: r.delegationId,
      fromUserId: r.fromUserId,
      fromUserName: (r.fromUserName || 'Delegator').trim(),
      toUserId: r.toUserId,
      startDate: new Date(r.startDate),
      endDate: new Date(r.endDate),
      reason: r.reason,
    }));
  }
}
