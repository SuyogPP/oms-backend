import re

filepath = "src/modules/authorization/delegations/repositories/delegations.repository.ts"
with open(filepath, "r") as f: content = f.read()

# 1. Replace UserProfiles joins with auth.tbl_Users
content = content.replace("LEFT JOIN [auth].[UserProfiles] fp ON fp.user_id = d.from_user_id", "LEFT JOIN [auth].tbl_Users] fp ON fp.user_id = d.from_user_id")
content = content.replace("LEFT JOIN [auth].[UserProfiles] tp ON tp.user_id = d.to_user_id", "LEFT JOIN [auth].tbl_Users] tp ON tp.user_id = d.to_user_id")

# 2. Fix DelegationPermissions insert
insert_old = """          INSERT INTO [auth].tbl_Delegation_Permissions] (
              DelegationPermissionID,
              delegation_id,
              permission_id,
              created_at
          )
          VALUES (
              NEWID(),
              @0,
              @1,
              SYSUTCDATETIME()
          );"""
insert_new = """          INSERT INTO [auth].tbl_Delegation_Permissions] (
              delegation_id,
              permission_id
          )
          VALUES (
              @0,
              @1
          );"""
content = content.replace(insert_old, insert_new)

with open(filepath, "w") as f: f.write(content)
print("Delegations repo patched")
