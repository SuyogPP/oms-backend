const fs = require('fs');
const path = require('path');

const repoPath = 'src/modules/authorization/users/repositories/users.repository.ts';
let content = fs.readFileSync(repoPath, 'utf8');

// 1. Remove dropped columns from all SELECTs
content = content.replace(/u\.IsDeleted AS isDeleted,\s*/g, '');
content = content.replace(/u\.DeletedAt AS deletedAt,\s*/g, '');
content = content.replace(/u\.DeletedBy AS deletedBy,\s*/g, '');
content = content.replace(/u\.LastFailedLoginAt AS lastFailedLoginAt,\s*/g, '');

// 2. Replace profile columns in SELECTs
content = content.replace(/p\.UserProfileID AS userProfileId,\s*/g, '');
content = content.replace(/p\.FirstName/g, 'u.FirstName');
content = content.replace(/p\.LastName/g, 'u.LastName');
content = content.replace(/p\.MobileNo/g, 'u.MobileNo');
content = content.replace(/p\.JobTitle/g, 'u.JobTitle');

// 3. Drop org profile columns mapped
content = content.replace(/CAST\(NULL AS UNIQUEIDENTIFIER\) AS organizationId,\s*p\.BusinessUnitID AS businessUnitId,\s*p\.DepartmentID AS departmentId,\s*p\.SectionID AS sectionId,\s*CAST\(NULL AS UNIQUEIDENTIFIER\) AS vendorId/g, 'u.OrgUnitID AS orgUnitId, u.VendorID AS vendorId');
content = content.replace(/CAST\(NULL AS UNIQUEIDENTIFIER\) AS organizationId,\s*u\.BusinessUnitID AS businessUnitId,\s*u\.DepartmentID AS departmentId,\s*u\.SectionID AS sectionId,\s*CAST\(NULL AS UNIQUEIDENTIFIER\) AS vendorId/g, 'u.OrgUnitID AS orgUnitId, u.VendorID AS vendorId');

// 4. Update the ROW_NUMBER in findAll
content = content.replace(/p\.BusinessUnitID/g, 'u.OrgUnitID');
content = content.replace(/p\.DepartmentID/g, 'u.OrgUnitID');
content = content.replace(/p\.SectionID/g, 'u.OrgUnitID');
content = content.replace(/organizationId,\s*businessUnitId,\s*departmentId,\s*sectionId,/g, 'orgUnitId,');

// 5. Remove JOINs
content = content.replace(/LEFT JOIN \[auth\]\.\[UserProfiles\] p ON p\.UserID = u\.UserID\s*/g, '');

// 6. Remove IsDeleted = 0
content = content.replace(/AND u\.IsDeleted = 0/g, '');
content = content.replace(/WHERE u\.UserID = @0 AND u\.IsDeleted = 0;/g, 'WHERE u.UserID = @0;');
content = content.replace(/WHERE u\.IsDeleted = 0/g, 'WHERE 1=1');
content = content.replace(/AND IsDeleted = 0/g, '');
content = content.replace(/WHERE UserID = @0 AND IsDeleted = 0/g, 'WHERE UserID = @0');

// 7. Fix mapUserRow
const mapUserRowRegex = /profile: r\.userProfileId[^;]+,\s*\}\s*:\s*null,/s;
content = content.replace(mapUserRowRegex, `firstName: r.firstName,
      lastName: r.lastName,
      displayName: r.displayName,
      mobileNo: r.phoneNumber,
      jobTitle: r.jobTitle,
      orgUnitId: r.orgUnitId,
      vendorId: r.vendorId,`);

content = content.replace(/isDeleted: r\.isDeleted === 1 \|\| r\.isDeleted === true,\s*/g, '');
content = content.replace(/deletedAt: r\.deletedAt \? new Date\(r\.deletedAt\) : null,\s*/g, '');
content = content.replace(/deletedBy: r\.deletedBy,\s*/g, '');
content = content.replace(/lastFailedLoginAt: r\.lastFailedLoginAt\s*\?\s*new Date\(r\.lastFailedLoginAt\)\s*:\s*null,\s*/g, '');

// 8. Update create method
content = content.replace(/FailedLoginCount,\s*ADObjectID,\s*CreatedAt,\s*UpdatedAt/s, 
  'FailedLoginCount, ADObjectID, FirstName, LastName, MobileNo, JobTitle, OrgUnitID, VendorID, CreatedAt, UpdatedAt');
content = content.replace(/0,\s*0,\s*@6,\s*SYSUTCDATETIME\(\),\s*SYSUTCDATETIME\(\)/s,
  '0, @6, @7, @8, @9, @10, @11, @12, SYSUTCDATETIME(), SYSUTCDATETIME()');
content = content.replace(/data\.adObjectId \|\| null,\s*\]/s, 
  `data.adObjectId || null,
        data.firstName || null,
        data.lastName || null,
        data.mobileNo || null,
        data.jobTitle || null,
        data.orgUnitId || null,
        data.vendorId || null,
      ]`);
content = content.replace(/IsDeleted,\s*/, '');
content = content.replace(/0,\s*0,\s*@6/, '0, @6'); // adjust for removed IsDeleted

// 9. Update update method
content = content.replace(/UserType = COALESCE\(@4, UserType\),/s, 
  `UserType = COALESCE(@4, UserType),
          FirstName = COALESCE(@5, FirstName),
          LastName = COALESCE(@6, LastName),
          MobileNo = COALESCE(@7, MobileNo),
          JobTitle = COALESCE(@8, JobTitle),
          OrgUnitID = COALESCE(@9, OrgUnitID),
          VendorID = COALESCE(@10, VendorID),`);
content = content.replace(/data\.userType \|\| null,\s*\]/s, 
  `data.userType || null,
        data.firstName || null,
        data.lastName || null,
        data.mobileNo || null,
        data.jobTitle || null,
        data.orgUnitId || null,
        data.vendorId || null,
      ]`);

// 10. Update softDelete method
content = content.replace(/SET \s*IsDeleted = 1,\s*IsActive = 0,\s*DeletedAt = SYSUTCDATETIME\(\),\s*DeletedBy = @1,\s*UpdatedAt = SYSUTCDATETIME\(\)/s, 
  'SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()');
content = content.replace(/\[userId, deletedBy \|\| null\]/s, '[userId]');

// 11. Update recordFailedLogin & resetFailedLoginCount
content = content.replace(/LastFailedLoginAt = SYSUTCDATETIME\(\),\s*/g, '');
content = content.replace(/LastFailedLoginAt = NULL,\s*/g, '');

fs.writeFileSync(repoPath, content);
console.log('users.repository.ts updated');
