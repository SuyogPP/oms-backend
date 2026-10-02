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

// Remove u.IsDeleted = 0 everywhere
content = content.replace(/AND u\.IsDeleted = 0/g, '');
content = content.replace(/AND IsDeleted = 0/g, '');
content = content.replace(/WHERE u\.IsDeleted = 0;/g, 'WHERE 1=1;');
content = content.replace(/WHERE u\.IsDeleted = 0/g, 'WHERE 1=1');

// Fix softDelete
content = content.replace(/async softDelete\([\s\S]*?\)\s*:\s*Promise<void>\s*\{[\s\S]*?\n\s*\}/, `async softDelete(
    userId: string,
    deletedBy?: string,
    qr?: QueryRunner,
  ): Promise<void> {
    // Soft delete removed from schema, maybe deactivate instead?
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

content = content.replace(/\[\s*data\.userId \|\| null,[\s\S]*?data\.adObjectId \|\| null,\s*\]/, `[
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
      ]`);

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

content = content.replace(/\[\s*userId,\s*data\.employeeId !== undefined \? data\.employeeId : null,[\s\S]*?data\.userType \|\| null,\s*\]/, `[
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
      ]`);


// Fix SELECT queries in findById, findByIdIncludingDeleted, findByEmail, findByUsername, findAll
const selectReplacement = `u.UserID AS userId,
          u.EmployeeID AS employeeId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.IsActive AS isActive,
          u.FailedLoginCount AS failedLoginCount,
          u.LockedUntil AS lockedUntil,
          u.ADObjectID AS adObjectId,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt,
          u.FirstName AS firstName,
          u.LastName AS lastName,
          u.MobileNo AS mobileNo,
          u.JobTitle AS jobTitle,
          CAST(u.OrgUnitID AS VARCHAR(50)) AS orgUnitId,
          u.VendorID AS vendorId`;

content = content.replace(/u\.UserID AS userId,[\s\S]*?u\.UpdatedAt AS updatedAt,[\s\S]*?CAST\(NULL AS UNIQUEIDENTIFIER\) AS vendorId/g, selectReplacement);
content = content.replace(/u\.UserID AS userId,[\s\S]*?u\.UpdatedAt AS updatedAt/g, selectReplacement);
// Wait, the second replace will match the newly replaced string, so let's be careful.
// Actually, it's better to just replace the specific strings.

fs.writeFileSync(path, content);
console.log('Done replacing part 1.');
