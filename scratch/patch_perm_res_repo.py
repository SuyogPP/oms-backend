import re

filepath = "src/modules/authorization/permission-resolution/repositories/permission-resolution.repository.ts"
with open(filepath, "r") as f: content = f.read()

# 1. Rewrite isUserInScope
old_isUserInScope = """  async isUserInScope(
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
  }"""

new_isUserInScope = """  async isUserInScope(
    requesterUserId: string,
    targetUserId: string,
  ): Promise<boolean> {
    if (!requesterUserId || !targetUserId) {
      return false;
    }

    const rows = await this.dataSource.query(
      `
      SELECT TOP 1 1 AS isAllowed
      FROM [auth].[tbl_Users] u
      WHERE u.user_id = @0
        AND (
            -- Rule 1: Self-inspection
            @1 = @0
            OR
            -- Rule 2: Requester has GLOBAL scope (SYSTEM_ADMIN)
            EXISTS (
                SELECT 1 
                FROM [auth].[tbl_User_Roles] ur
                INNER JOIN [auth].[tbl_Roles] r ON r.role_id = ur.role_id
                WHERE ur.user_id = @1
                  AND r.role_code = 'SYSTEM_ADMIN'
                  AND ur.is_active = 1
            )
            OR
            -- Rule 3: Target user's org_unit_id is in requester's visible scope (closure table)
            EXISTS (
                SELECT 1 
                FROM [auth].[tbl_User_Roles] ur
                INNER JOIN [masters].[org_unit_closure] ouc ON ouc.ancestor_id = ur.org_unit_id
                WHERE ur.user_id = @1
                  AND ur.is_active = 1
                  AND ouc.descendant_id = u.org_unit_id
            )
        );
      `,
      [targetUserId, requesterUserId],
    );

    return rows && rows.length > 0;
  }"""
content = content.replace(old_isUserInScope, new_isUserInScope)

# 2. Fix isUserActive (IsDeleted is dropped)
old_isUserActive = """  async isUserActive(userId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `
      SELECT 
          CASE WHEN u.is_active = 1 AND u.IsDeleted = 0 THEN 1 ELSE 0 END AS isLive
      FROM [auth].tbl_Users] u
      WHERE u.user_id = @0;
      `,
      [userId],
    );"""
new_isUserActive = """  async isUserActive(userId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `
      SELECT 
          CASE WHEN u.is_active = 1 THEN 1 ELSE 0 END AS isLive
      FROM [auth].[tbl_Users] u
      WHERE u.user_id = @0;
      `,
      [userId],
    );"""
content = content.replace(old_isUserActive, new_isUserActive)

# 3. Fix resolveDelegations (UserProfiles join -> auth.tbl_Users)
content = content.replace("LEFT JOIN [auth].[UserProfiles] fp ON fp.user_id = d.from_user_id", "LEFT JOIN [auth].[tbl_Users] fp ON fp.user_id = d.from_user_id")

with open(filepath, "w") as f: f.write(content)
print("Permission Resolution repo patched")
