import re

repo_path = "src/modules/authorization/vendor-users/repositories/vendor-users.repository.ts"
with open(repo_path, "r") as f: content = f.read()

# findAll & findById updates
old_select = """          u.IsDeleted AS isDeleted,
          u.failed_login_count AS failedLoginCount,
          u.locked_until AS lockedUntil,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          p.UserProfileID AS userProfileId,
          p.first_name AS firstName,
          p.last_name AS lastName,
          RTRIM(LTRIM(p.first_name + ' ' + ISNULL(p.last_name, ''))) AS displayName,
          p.mobile_no AS phoneNumber,
          p.job_title AS jobTitle,
          CAST(NULL AS UNIQUEIDENTIFIER) AS vendorId
      FROM [auth].tbl_Users] u
      INNER JOIN [auth].[UserProfiles] p ON p.user_id = u.user_id
      WHERE u.UserType = 'VENDOR'
        AND u.IsDeleted = 0"""

new_select = """          0 AS isDeleted,
          u.failed_login_count AS failedLoginCount,
          u.locked_until AS lockedUntil,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          NEWID() AS userProfileId,
          u.first_name AS firstName,
          u.last_name AS lastName,
          RTRIM(LTRIM(u.first_name + ' ' + ISNULL(u.last_name, ''))) AS displayName,
          u.mobile_no AS phoneNumber,
          u.job_title AS jobTitle,
          u.vendor_id AS vendorId
      FROM [auth].[tbl_Users] u
      WHERE u.user_type = 'VENDOR'"""
content = content.replace(old_select, new_select)

old_select_id = """          u.IsDeleted AS isDeleted,
          u.failed_login_count AS failedLoginCount,
          u.locked_until AS lockedUntil,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          p.UserProfileID AS userProfileId,
          p.first_name AS firstName,
          p.last_name AS lastName,
          RTRIM(LTRIM(p.first_name + ' ' + ISNULL(p.last_name, ''))) AS displayName,
          p.mobile_no AS phoneNumber,
          p.job_title AS jobTitle,
          CAST(NULL AS UNIQUEIDENTIFIER) AS vendorId
      FROM [auth].tbl_Users] u
      INNER JOIN [auth].[UserProfiles] p ON p.user_id = u.user_id
      WHERE u.user_id = @0
        AND u.UserType = 'VENDOR'
        AND u.IsDeleted = 0;"""

new_select_id = """          0 AS isDeleted,
          u.failed_login_count AS failedLoginCount,
          u.locked_until AS lockedUntil,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          NEWID() AS userProfileId,
          u.first_name AS firstName,
          u.last_name AS lastName,
          RTRIM(LTRIM(u.first_name + ' ' + ISNULL(u.last_name, ''))) AS displayName,
          u.mobile_no AS phoneNumber,
          u.job_title AS jobTitle,
          u.vendor_id AS vendorId
      FROM [auth].[tbl_Users] u
      WHERE u.user_id = @0
        AND u.user_type = 'VENDOR';"""
content = content.replace(old_select_id, new_select_id)

# create
old_create = """        INSERT INTO [auth].tbl_Users] (
            user_id,
            Username,
            Email,
            UserType,
            is_active,
            IsDeleted,
            failed_login_count,
            created_at,
            updated_at
        )
        OUTPUT INSERTED.user_id AS userId
        VALUES (
            NEWID(),
            @0,
            @1,
            'VENDOR',
            1,
            0,
            0,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );
        `,
        [data.username, data.email],
      );

      const userId = userRows[0].userId;
      const displayName = `${data.firstName} ${data.lastName}`.trim();

      // Insert profile with V5 invariant (no org unit references)
      await runner.query(
        `
        INSERT INTO [auth].[UserProfiles] (
            UserProfileID,
            user_id,
            first_name,
            last_name,
            mobile_no,
            job_title,
            BusinessUnitID,
            DepartmentID,
            SectionID
        )
        VALUES (
            NEWID(),
            @0,
            @1,
            @2,
            @3,
            @4,
            NULL,
            NULL,
            NULL
        );
        `,
        [
          userId,
          data.firstName,
          data.lastName,
          data.phoneNumber || null,
          data.jobTitle || null,
        ],
      );"""

new_create = """        INSERT INTO [auth].[tbl_Users] (
            user_id,
            username,
            email,
            user_type,
            is_active,
            failed_login_count,
            vendor_id,
            first_name,
            last_name,
            mobile_no,
            job_title,
            created_at,
            updated_at
        )
        OUTPUT INSERTED.user_id AS userId
        VALUES (
            NEWID(),
            @0,
            @1,
            'VENDOR',
            1,
            0,
            @2,
            @3,
            @4,
            @5,
            @6,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );
        `,
        [data.username, data.email, data.vendorId, data.firstName, data.lastName, data.phoneNumber || null, data.jobTitle || null],
      );

      const userId = userRows[0].userId;"""
content = content.replace(old_create, new_create)

# update
old_update = """      if (data.email) {
        await runner.query(
          `
          UPDATE [auth].tbl_Users]
          SET Email = @1, updated_at = SYSUTCDATETIME()
          WHERE user_id = @0 AND UserType = 'VENDOR';
          `,
          [userId, data.email],
        );
      }

      await runner.query(
        `
        UPDATE [auth].[UserProfiles]
        SET 
            first_name = COALESCE(@1, first_name),
            last_name = COALESCE(@2, last_name),
            mobile_no = COALESCE(@3, mobile_no),
            job_title = COALESCE(@4, job_title)
        WHERE user_id = @0;
        `,
        [
          userId,
          data.firstName || null,
          data.lastName || null,
          data.phoneNumber || null,
          data.jobTitle || null,
        ],
      );"""

new_update = """      const updates: string[] = [];
      const params: any[] = [userId];
      let pIdx = 1;

      if (data.email !== undefined) {
        updates.push(`email = @${pIdx++}`);
        params.push(data.email);
      }
      if (data.firstName !== undefined) {
        updates.push(`first_name = @${pIdx++}`);
        params.push(data.firstName);
      }
      if (data.lastName !== undefined) {
        updates.push(`last_name = @${pIdx++}`);
        params.push(data.lastName);
      }
      if (data.phoneNumber !== undefined) {
        updates.push(`mobile_no = @${pIdx++}`);
        params.push(data.phoneNumber);
      }
      if (data.jobTitle !== undefined) {
        updates.push(`job_title = @${pIdx++}`);
        params.push(data.jobTitle);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = SYSUTCDATETIME()`);
        await runner.query(
          `
          UPDATE [auth].[tbl_Users]
          SET ${updates.join(', ')}
          WHERE user_id = @0 AND user_type = 'VENDOR';
          `,
          params,
        );
      }"""
content = content.replace(old_update, new_update)

# deactivate
content = content.replace("UPDATE [auth].tbl_Users]\n      SET is_active = 0, updated_at = SYSUTCDATETIME()\n      WHERE user_id = @0 AND UserType = 'VENDOR';", "UPDATE [auth].[tbl_Users]\n      SET is_active = 0, updated_at = SYSUTCDATETIME()\n      WHERE user_id = @0 AND user_type = 'VENDOR';")

# deactivateAllByVendorId
content = content.replace("UPDATE [auth].tbl_Users]\n      SET is_active = 0, updated_at = SYSUTCDATETIME()\n      WHERE UserType = 'VENDOR' AND IsDeleted = 0;", "UPDATE [auth].[tbl_Users]\n      SET is_active = 0, updated_at = SYSUTCDATETIME()\n      WHERE user_type = 'VENDOR' AND vendor_id = @0;")
content = content.replace("deactivateAllByVendorId(\n    vendorId: string,\n    qr?: QueryRunner,\n  )", "deactivateAllByVendorId(\n    vendorId: number,\n    qr?: QueryRunner,\n  )")
content = content.replace("`\n    );", "`,\n      [vendorId]\n    );")

with open(repo_path, "w") as f: f.write(content)
print("Repository updated")
