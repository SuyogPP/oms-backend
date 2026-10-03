import re

filepath_repo = "src/modules/authorization/user-import/repositories/user-import.repository.ts"
with open(filepath_repo, "r") as f: content_repo = f.read()

# Replace findExistingEmployeeIds (UserProfiles -> tbl_Users)
content_repo = content_repo.replace(
    "SELECT LOWER(employee_id) as employeeId FROM [auth].[UserProfiles]",
    "SELECT LOWER(employee_id) as employeeId FROM [auth].[tbl_Users]"
)

# Replace findOrgUnitsByCodes ([org].[OrgUnits] -> [masters].[org_unit])
content_repo = content_repo.replace(
    "SELECT Code as code, OrgUnitId as orgUnitId, OrgUnitTypeId as typeId, Name as name FROM [org].[OrgUnits]",
    "SELECT org_unit_code as code, org_unit_id as orgUnitId, org_unit_type_id as typeId, org_unit_name as name FROM [masters].[org_unit]"
)

# Remove findScopeDefinitions
content_repo = re.sub(r"  /\*\*\n   \* Retrieves all scope definitions\.[\s\S]*?\}\n", "", content_repo)

with open(filepath_repo, "w") as f: f.write(content_repo)


filepath_service = "src/modules/authorization/user-import/services/user-import.service.ts"
with open(filepath_service, "r") as f: content_service = f.read()

# Remove scope definitions from validate
content_service = re.sub(r"    const scopeDefs = await this\.userImportRepo\.findScopeDefinitions\(\);\n", "", content_service)
content_service = re.sub(r"    const scopeDefMap = new Map\(scopeDefs\.map\(\(s\) => \[s\.scopeCode, s\.scopeDefinitionId\]\)\);\n", "", content_service)

# Rewrite the loop validation for scope definition
# In the loop:
# let resolvedScopeDefId: string | undefined;
# if (row.scopeCode) { ... }
scope_validation_old = r"""      let resolvedScopeDefId: string \| undefined;
      if \(row\.scopeCode\) \{
        resolvedScopeDefId = scopeDefMap\.get\(row\.scopeCode\);
        if \(!resolvedScopeDefId\) \{
          errors\.push\(\{ rowNumber: rowNum, error: `ScopeCode \[\$\{row\.scopeCode\}\] is invalid\.` \}\);
          continue;
        \}
      \}"""
content_service = re.sub(scope_validation_old, "", content_service)
content_service = content_service.replace("scopeDefinitionId: resolvedScopeDefId,", "")

# Now fix the Commit logic:
# 1. Update tbl_Users insert to include UserProfiles columns and org_unit_id
insert_users_old = r"""          INSERT INTO \[auth\]\.tbl_Users\] \(
              user_id,
              Username,
              Email,
              employee_id,
              UserType,
              is_active,
              IsDeleted,
              failed_login_count,
              created_at,
              updated_at
          \)
          OUTPUT INSERTED\.user_id AS userId
          VALUES \(
              NEWID\(\),
              @0,
              @1,
              @2,
              'INTERNAL',
              0,
              0,
              0,
              SYSUTCDATETIME\(\),
              SYSUTCDATETIME\(\)
          \);"""
insert_users_new = """          INSERT INTO [auth].[tbl_Users] (
              user_id,
              username,
              email,
              employee_id,
              first_name,
              last_name,
              job_title,
              org_unit_id,
              user_type,
              is_active,
              failed_login_count,
              created_at,
              updated_at
          )
          OUTPUT INSERTED.user_id AS userId
          VALUES (
              NEWID(),
              @0,
              @1,
              @2,
              @3,
              @4,
              @5,
              @6,
              'INTERNAL',
              0,
              0,
              SYSUTCDATETIME(),
              SYSUTCDATETIME()
          );"""
content_service = re.sub(insert_users_old, insert_users_new, content_service)
content_service = content_service.replace(
    "[row.username, row.email, row.employeeId || null],",
    "[row.username, row.email, row.employeeId || null, row.firstName, row.lastName, row.jobTitle || null, row.departmentId || null],"
)

# 2. Remove UserProfiles insert
profile_insert = r"""        // 2\. Insert Profile\s*await queryRunner\.query\(\s*`\s*INSERT INTO \[auth\]\.\[UserProfiles\] \([\s\S]*?`,\s*\[[\s\S]*?\],\s*\);"""
content_service = re.sub(profile_insert, "", content_service)

# 3. Update User Roles insert (add org_unit_id)
insert_roles_old = r"""              INSERT INTO \[auth\]\.tbl_User_Roles\] \(
                  user_role_id,
                  user_id,
                  role_id,
                  effective_from,
                  is_active,
                  assigned_by,
                  assigned_at
              \)
              VALUES \(
                  NEWID\(\),
                  @0,
                  @1,
                  SYSUTCDATETIME\(\),
                  1,
                  @2,
                  SYSUTCDATETIME\(\)
              \);"""
insert_roles_new = """              INSERT INTO [auth].[tbl_User_Roles] (
                  user_role_id,
                  user_id,
                  role_id,
                  org_unit_id,
                  effective_from,
                  is_active,
                  assigned_by,
                  assigned_at
              )
              VALUES (
                  NEWID(),
                  @0,
                  @1,
                  @3,
                  SYSUTCDATETIME(),
                  1,
                  @2,
                  SYSUTCDATETIME()
              );"""
content_service = re.sub(insert_roles_old, insert_roles_new, content_service)
content_service = content_service.replace(
    "[userId, roleId, operatorUserId || null],",
    "[userId, roleId, operatorUserId || null, row.scopeOrgUnitId || null],"
)

# 4. Remove UserOrganizationScopes insert
scope_insert = r"""        // 5\. Assign Scopes if specified\s*if \(row\.scopeDefinitionId\) \{[\s\S]*?\}"""
# Actually, the string matches `if (row.scopeDefinitionId) { ... }`. The regex might be tricky. Let's do it simply:
content_service = re.sub(r"        // 5\. Assign Scopes if specified[\s\S]*?\}\n\s*\}\n\n        // 6\. Emit", "        // 6. Emit", content_service)

with open(filepath_service, "w") as f: f.write(content_service)
print("User Import files patched")
