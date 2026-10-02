const fs = require('fs');

const path = '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/users/repositories/users.repository.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace mapUserRow
content = content.replace(/private mapUserRow\(r: any\): IUserWithProfile \{[\s\S]*?\}\n\s*\}/, `private mapUserRow(r: any): IUserWithProfile {
    let status: 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'LOCKED' = 'ACTIVE';
    if (r.lockedUntil && new Date(r.lockedUntil) > new Date()) {
      status = 'LOCKED';
    } else if (!r.isActive) {
      status = 'INACTIVE';
    }

    const roles: string[] = r.roles
      ? typeof r.roles === 'string'
        ? r.roles
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : Array.isArray(r.roles)
          ? r.roles
          : []
      : [];

    return {
      userId: r.userId,
      employeeId: r.employeeId,
      username: r.username,
      email: r.email,
      userType: r.userType,
      isActive: r.isActive === 1 || r.isActive === true,
      failedLoginCount: Number(r.failedLoginCount || 0),
      lockedUntil: r.lockedUntil ? new Date(r.lockedUntil) : null,
      adObjectId: r.adObjectId,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      status,
      roles,
      firstName: r.firstName,
      lastName: r.lastName,
      mobileNo: r.mobileNo,
      jobTitle: r.jobTitle,
      orgUnitId: r.orgUnitId,
      vendorId: r.vendorId,
    };
  }`);

// Remove IsDeleted references safely
content = content.replace(/AND u\.IsDeleted = 0/g, '');
content = content.replace(/WHERE u\.IsDeleted = 0/g, 'WHERE 1=1');
content = content.replace(/WHERE UserID = @0 AND IsDeleted = 0;/g, 'WHERE UserID = @0;');
content = content.replace(/u\.IsDeleted = 0/g, '1=1');

// Replace SELECT lists explicitly
const oldSelectJoin = `          u.IsDeleted AS isDeleted,
          u.DeletedAt AS deletedAt,
          u.DeletedBy AS deletedBy,
          u.FailedLoginCount AS failedLoginCount,
          u.LastFailedLoginAt AS lastFailedLoginAt,
          u.LockedUntil AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt,
          p.UserProfileID AS userProfileId,
          p.FirstName AS firstName,
          p.LastName AS lastName,
          RTRIM(LTRIM(p.FirstName + ' ' + ISNULL(p.LastName, ''))) AS displayName,
          p.MobileNo AS phoneNumber,
          p.JobTitle AS jobTitle,
          CAST(NULL AS UNIQUEIDENTIFIER) AS organizationId,
          p.BusinessUnitID AS businessUnitId,
          p.DepartmentID AS departmentId,
          p.SectionID AS sectionId,
          CAST(NULL AS UNIQUEIDENTIFIER) AS vendorId,`;

const newSelectJoin = `          u.FailedLoginCount AS failedLoginCount,
          u.LockedUntil AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt,
          u.FirstName AS firstName,
          u.LastName AS lastName,
          u.MobileNo AS mobileNo,
          u.JobTitle AS jobTitle,
          CAST(u.OrgUnitID AS VARCHAR(50)) AS orgUnitId,
          u.VendorID AS vendorId,`;

content = content.split(oldSelectJoin).join(newSelectJoin);
content = content.replace(/LEFT JOIN \[auth\]\.\[UserProfiles\] p ON p\.UserID = u\.UserID/g, '');

const oldSelectPlain = `          u.IsDeleted AS isDeleted,
          u.DeletedAt AS deletedAt,
          u.DeletedBy AS deletedBy,
          u.FailedLoginCount AS failedLoginCount,
          u.LastFailedLoginAt AS lastFailedLoginAt,
          u.LockedUntil AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt`;

const newSelectPlain = `          u.FailedLoginCount AS failedLoginCount,
          u.LockedUntil AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt`;

content = content.split(oldSelectPlain).join(newSelectPlain);

const oldSelectResult = `          isDeleted,
          deletedAt,
          deletedBy,
          failedLoginCount,
          lastFailedLoginAt,
          lockedUntil,
          adObjectId,
          createdAt,
          updatedAt,
          userProfileId,
          firstName,
          lastName,
          displayName,
          phoneNumber,
          jobTitle,
          organizationId,
          businessUnitId,
          departmentId,
          sectionId,
          vendorId,`;

const newSelectResult = `          failedLoginCount,
          lockedUntil,
          adObjectId,
          createdAt,
          updatedAt,
          firstName,
          lastName,
          mobileNo,
          jobTitle,
          orgUnitId,
          vendorId,`;

content = content.split(oldSelectResult).join(newSelectResult);

// Fix search in findAll
content = content.replace(/LOWER\(p\.FirstName\) LIKE LOWER\(@\$\{paramIndex\}\) OR \n\s*LOWER\(p\.LastName\) LIKE LOWER\(@\$\{paramIndex\}\)/g, 
  'LOWER(u.FirstName) LIKE LOWER(@${paramIndex}) OR LOWER(u.LastName) LIKE LOWER(@${paramIndex})');

content = content.replace(/WHERE \(p\.DepartmentID IS NOT NULL AND v\.OrgUnitId = p\.DepartmentID\)\n\s*OR \(p\.BusinessUnitID IS NOT NULL AND v\.OrgUnitId = p\.BusinessUnitID\)\n\s*OR \(p\.SectionID IS NOT NULL AND v\.OrgUnitId = p\.SectionID\)/g,
  'WHERE (u.OrgUnitID IS NOT NULL AND v.OrgUnitId = u.OrgUnitID)');

content = content.replace(/if \(departmentId\) \{\n\s*whereClause \+= ` AND p\.DepartmentID = @\$\{paramIndex\}`;/g,
  'if (departmentId) {\n      whereClause += ` AND u.OrgUnitID = @${paramIndex}`;');
content = content.replace(/if \(businessUnitId\) \{\n\s*whereClause \+= ` AND p\.BusinessUnitID = @\$\{paramIndex\}`;/g,
  'if (businessUnitId) {\n      whereClause += ` AND u.OrgUnitID = @${paramIndex}`;');
content = content.replace(/if \(organizationId\) \{\n\s*whereClause \+= ` AND \(p\.DepartmentID = @\$\{paramIndex\} OR p\.BusinessUnitID = @\$\{paramIndex\}\)`;/g,
  'if (organizationId) {\n      whereClause += ` AND u.OrgUnitID = @${paramIndex}`;');

content = content.replace(/firstName: 'p\.FirstName',/g, "firstName: 'u.FirstName',");
content = content.replace(/lastName: 'p\.LastName',/g, "lastName: 'u.LastName',");

// Fix softDelete
content = content.replace(/async softDelete\([\s\S]*?\)\s*:\s*Promise<void>\s*\{[\s\S]*?\n\s*\}/, `async softDelete(
    userId: string,
    deletedBy?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.deactivate(userId, qr);
  }`);

// Fix create
content = content.replace(/INSERT INTO \[auth\]\.\[Users\] \([\s\S]*?VALUES \([\s\S]*?\);/, `INSERT INTO [auth].[Users] (
          UserID,
          EmployeeID,
          Username,
          Email,
          UserType,
          IsActive,
          FailedLoginCount,
          ADObjectID,
          FirstName,
          LastName,
          MobileNo,
          JobTitle,
          OrgUnitID,
          VendorID,
          CreatedAt,
          UpdatedAt
      )
      OUTPUT INSERTED.UserID AS userId
      VALUES (
          COALESCE(@0, NEWID()),
          @1,
          @2,
          @3,
          @4,
          @5,
          0,
          @6,
          @7,
          @8,
          @9,
          @10,
          @11,
          @12,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
      );`);

content = content.replace(/\[\n\s*data\.userId \|\| null,\n\s*data\.employeeId \|\| null,\n\s*data\.username,\n\s*data\.email,\n\s*data\.userType,\n\s*data\.isActive !== undefined \? \(data\.isActive \? 1 : 0\) : 0,\n\s*data\.adObjectId \|\| null,\n\s*\],/, `[
        data.userId || null,
        data.employeeId || null,
        data.username,
        data.email,
        data.userType,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : 0,
        data.adObjectId || null,
        data.firstName || null,
        data.lastName || null,
        data.mobileNo || null,
        data.jobTitle || null,
        data.orgUnitId || null,
        data.vendorId !== undefined ? data.vendorId : null,
      ],`);

// Fix update
content = content.replace(/UPDATE \[auth\]\.\[Users\]\s*SET\s*[\s\S]*?WHERE UserID = @0[^;]*;/, `UPDATE [auth].[Users]
      SET 
          EmployeeID = COALESCE(@1, EmployeeID),
          Username = COALESCE(@2, Username),
          Email = COALESCE(@3, Email),
          UserType = COALESCE(@4, UserType),
          FirstName = COALESCE(@5, FirstName),
          LastName = COALESCE(@6, LastName),
          MobileNo = COALESCE(@7, MobileNo),
          JobTitle = COALESCE(@8, JobTitle),
          OrgUnitID = COALESCE(@9, OrgUnitID),
          VendorID = COALESCE(@10, VendorID),
          UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0;`);

content = content.replace(/\[\n\s*userId,\n\s*data\.employeeId !== undefined \? data\.employeeId : null,\n\s*data\.username \|\| null,\n\s*data\.email \|\| null,\n\s*data\.userType \|\| null,\n\s*\],/, `[
        userId,
        data.employeeId !== undefined ? data.employeeId : null,
        data.username || null,
        data.email || null,
        data.userType || null,
        data.firstName || null,
        data.lastName || null,
        data.mobileNo || null,
        data.jobTitle || null,
        data.orgUnitId || null,
        data.vendorId !== undefined ? data.vendorId : null,
      ],`);

fs.writeFileSync(path, content);
console.log('Modified repo safely');
