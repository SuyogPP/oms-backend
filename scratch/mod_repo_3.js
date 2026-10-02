const fs = require('fs');
const path = '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/users/repositories/users.repository.ts';
let content = fs.readFileSync(path, 'utf8');

const mapUserRowStart = content.indexOf('  private mapUserRow(r: any): IUserWithProfile {');
const mapUserRowEnd = content.indexOf('  async create(data: ICreateUserData, qr?: QueryRunner): Promise<string> {');
if (mapUserRowStart !== -1 && mapUserRowEnd !== -1) {
  const newMapUserRow = `  private mapUserRow(r: any): IUserWithProfile {
    let status: 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'LOCKED' = 'ACTIVE';
    if (r.lockedUntil && new Date(r.lockedUntil) > new Date()) {
      status = 'LOCKED';
    } else if (!r.isActive) {
      status = 'INACTIVE';
    }

    const roles: string[] = r.roles
      ? typeof r.roles === 'string'
        ? r.roles.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(r.roles) ? r.roles : []
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
  }

  /**
   * Creates a new user row in auth.Users.
   */
`;
  content = content.substring(0, mapUserRowStart) + newMapUserRow + content.substring(mapUserRowEnd);
}

const softDeleteStart = content.indexOf('  async softDelete(');
const softDeleteEnd = content.indexOf('  async unlock(userId: string, qr?: QueryRunner): Promise<void> {');
if (softDeleteStart !== -1 && softDeleteEnd !== -1) {
  const newSoftDelete = `  async softDelete(
    userId: string,
    deletedBy?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.deactivate(userId, qr);
  }

  /**
   * Unlocks a locked user account (clears failed attempts, last failed login, and lockout window).
   */
`;
  content = content.substring(0, softDeleteStart) + newSoftDelete + content.substring(softDeleteEnd);
}

// explicit string replaces
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

// create and update
const createStart = content.indexOf('INSERT INTO [auth].[Users] (');
const createEnd = content.indexOf('      OUTPUT INSERTED.UserID AS userId');
if (createStart !== -1 && createEnd !== -1) {
  content = content.substring(0, createStart) + `INSERT INTO [auth].[Users] (
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
` + content.substring(createEnd);
}

content = content.replace(/VALUES \(\n\s*COALESCE\(@0, NEWID\(\)\),\n\s*@1,\n\s*@2,\n\s*@3,\n\s*@4,\n\s*@5,\n\s*0,\n\s*0,\n\s*@6,\n\s*SYSUTCDATETIME\(\),\n\s*SYSUTCDATETIME\(\)\n\s*\);/, `VALUES (
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

const updateStart = content.indexOf('UPDATE [auth].[Users]\n      SET \n          EmployeeID = COALESCE(@1, EmployeeID),');
const updateEnd = content.indexOf('      WHERE UserID = @0 AND IsDeleted = 0;');
if (updateStart !== -1 && updateEnd !== -1) {
  content = content.substring(0, updateStart) + `UPDATE [auth].[Users]
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
` + content.substring(updateEnd);
}

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

content = content.replace(/LOWER\(p\.FirstName\)/g, 'LOWER(u.FirstName)');
content = content.replace(/LOWER\(p\.LastName\)/g, 'LOWER(u.LastName)');
content = content.replace(/p\.DepartmentID IS NOT NULL AND v\.OrgUnitId = p\.DepartmentID/g, 'u.OrgUnitID IS NOT NULL AND v.OrgUnitId = u.OrgUnitID');
content = content.replace(/OR \(p\.BusinessUnitID IS NOT NULL AND v\.OrgUnitId = p\.BusinessUnitID\)/g, '');
content = content.replace(/OR \(p\.SectionID IS NOT NULL AND v\.OrgUnitId = p\.SectionID\)/g, '');

content = content.replace(/if \(departmentId\) \{\n\s*whereClause \+= ` AND p\.DepartmentID = @\$\{paramIndex\}`;/g, 'if (departmentId) {\n      whereClause += ` AND u.OrgUnitID = @${paramIndex}`;');
content = content.replace(/if \(businessUnitId\) \{\n\s*whereClause \+= ` AND p\.BusinessUnitID = @\$\{paramIndex\}`;/g, 'if (businessUnitId) {\n      whereClause += ` AND u.OrgUnitID = @${paramIndex}`;');
content = content.replace(/if \(organizationId\) \{\n\s*whereClause \+= ` AND \(p\.DepartmentID = @\$\{paramIndex\} OR p\.BusinessUnitID = @\$\{paramIndex\}\)`;/g, 'if (organizationId) {\n      whereClause += ` AND u.OrgUnitID = @${paramIndex}`;');

content = content.replace(/firstName: 'p\.FirstName',/g, "firstName: 'u.FirstName',");
content = content.replace(/lastName: 'p\.LastName',/g, "lastName: 'u.LastName',");

// Remove IsDeleted
content = content.replace(/AND u\.IsDeleted = 0/g, '');
content = content.replace(/WHERE u\.IsDeleted = 0;/g, 'WHERE 1=1;');
content = content.replace(/WHERE u\.IsDeleted = 0/g, 'WHERE 1=1');
content = content.replace(/AND IsDeleted = 0/g, '');
content = content.replace(/WHERE UserID = @0 AND IsDeleted = 0;/g, 'WHERE UserID = @0;');

fs.writeFileSync(path, content);
console.log('Done safely mapping');
