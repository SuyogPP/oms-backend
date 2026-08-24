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
      FROM [auth].[Users] u
      LEFT JOIN [auth].[UserProfiles] p ON p.UserID = u.UserID
      WHERE u.UserID = @0
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
                WHERE s.UserID = @1
                  AND sd.ScopeCode = 'GLOBAL'
                  AND (s.IsActive = 1 OR s.IsActive IS NULL)
                  AND (s.EffectiveFrom IS NULL OR s.EffectiveFrom <= SYSUTCDATETIME())
                  AND (s.EffectiveTo IS NULL OR s.EffectiveTo > SYSUTCDATETIME())
            )
            OR
            -- Rule 3: Target user's department/unit is in requester's visible subtree
            EXISTS (
                SELECT 1
                FROM [org].[fn_VisibleOrgUnits](@1) v
                WHERE (p.DepartmentID IS NOT NULL AND v.OrgUnitId = p.DepartmentID)
                   OR (p.BusinessUnitID IS NOT NULL AND v.OrgUnitId = p.BusinessUnitID)
                   OR (p.SectionID IS NOT NULL AND v.OrgUnitId = p.SectionID)
                   OR EXISTS (
                       SELECT 1
                       FROM [org].[UserOrgUnitAssignments] a
                       WHERE a.UserID = u.UserID
                         AND a.IsActive = 1
                         AND a.OrgUnitId = v.OrgUnitId
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
          CASE WHEN u.IsActive = 1 AND u.IsDeleted = 0 THEN 1 ELSE 0 END AS isLive
      FROM [auth].[Users] u
      WHERE u.UserID = @0;
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
              ur.RoleID AS roleId,
              r.RoleCode AS roleCode,
              r.RoleName AS roleName,
              0 AS depth,
              CAST(r.RoleCode AS NVARCHAR(500)) AS inheritedVia,
              ur.EffectiveFrom AS effectiveFrom,
              ur.EffectiveTo AS effectiveTo
          FROM [auth].[UserRoles] ur
          INNER JOIN [auth].[Roles] r ON r.RoleID = ur.RoleID
          WHERE ur.UserID = @0
            AND ur.IsActive = 1
            AND r.IsActive = 1
            AND ur.EffectiveFrom <= SYSUTCDATETIME()
            AND (ur.EffectiveTo IS NULL OR ur.EffectiveTo > SYSUTCDATETIME())

          UNION ALL

          -- Recursive: Parent role confers all child role permissions
          SELECT 
              cr.RoleID AS roleId,
              cr.RoleCode AS roleCode,
              cr.RoleName AS roleName,
              rc.depth + 1 AS depth,
              CAST(rc.inheritedVia + ' ← ' + cr.RoleCode AS NVARCHAR(500)) AS inheritedVia,
              rc.effectiveFrom,
              rc.effectiveTo
          FROM [auth].[RoleHierarchy] rh
          INNER JOIN RoleClosure rc ON rc.roleId = rh.ParentRoleID
          INNER JOIN [auth].[Roles] cr ON cr.RoleID = rh.ChildRoleID
          WHERE rh.IsActive = 1
            AND cr.IsActive = 1
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
   * Note on auth.PermissionConditions / auth.RolePermissionConditions:
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
          rp.RoleID AS roleId,
          p.PermissionID AS permissionId,
          p.PermissionCode AS permissionCode,
          p.ModuleName AS moduleName,
          p.ActionName AS actionName
      FROM [auth].[RolePermissions] rp
      INNER JOIN [auth].[Permissions] p ON p.PermissionID = rp.PermissionID
      WHERE rp.RoleID IN (${placeholders});
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
          upo.UserPermissionOverrideID AS overrideId,
          upo.UserID AS userId,
          upo.PermissionID AS permissionId,
          p.PermissionCode AS permissionCode,
          upo.IsGranted AS isGranted,
          upo.Reason AS reason,
          upo.ApprovedBy AS approvedBy,
          upo.EffectiveFrom AS effectiveFrom,
          upo.EffectiveTo AS effectiveTo
      FROM [auth].[UserPermissionOverrides] upo
      INNER JOIN [auth].[Permissions] p ON p.PermissionID = upo.PermissionID
      WHERE upo.UserID = @0
        AND upo.EffectiveFrom <= SYSUTCDATETIME()
        AND (upo.EffectiveTo IS NULL OR upo.EffectiveTo > SYSUTCDATETIME());
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
            d.DelegationID AS delegationId,
            d.FromUserID AS fromUserId,
            CONCAT(fp.FirstName, ' ', fp.LastName) AS fromUserName,
            d.ToUserID AS toUserId,
            d.StartDate AS startDate,
            d.EndDate AS endDate,
            d.Reason AS reason,
            p.PermissionCode AS permissionCode
        FROM [auth].[Delegations] d
        LEFT JOIN [auth].[UserProfiles] fp ON fp.UserID = d.FromUserID
        INNER JOIN [auth].[DelegationPermissions] dp ON dp.DelegationID = d.DelegationID
        INNER JOIN [auth].[Permissions] p ON p.PermissionID = dp.PermissionID
        WHERE d.ToUserID = @0
          AND d.IsActive = 1
          AND d.StartDate <= SYSUTCDATETIME()
          AND d.EndDate > SYSUTCDATETIME();
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
          d.DelegationID AS delegationId,
          d.FromUserID AS fromUserId,
          CONCAT(fp.FirstName, ' ', fp.LastName) AS fromUserName,
          d.ToUserID AS toUserId,
          d.StartDate AS startDate,
          d.EndDate AS endDate,
          d.Reason AS reason
      FROM [auth].[Delegations] d
      LEFT JOIN [auth].[UserProfiles] fp ON fp.UserID = d.FromUserID
      WHERE d.ToUserID = @0
        AND d.IsActive = 1
        AND d.StartDate <= SYSUTCDATETIME()
        AND d.EndDate > SYSUTCDATETIME();
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
