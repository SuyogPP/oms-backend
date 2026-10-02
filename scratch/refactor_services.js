const fs = require('fs');
const path = require('path');

// 1. users.service.ts
let svcPath = 'src/modules/authorization/users/services/users.service.ts';
let content = fs.readFileSync(svcPath, 'utf8');

// Remove UserProfilesRepository
content = content.replace(/import \{ UserProfilesRepository \} from '\.\.\/repositories\/user-profiles\.repository';\n/, '');
content = content.replace(/private readonly userProfilesRepository: UserProfilesRepository,\s*/, '');

// Remove isDeleted
content = content.replace(/\|\| existing\.isDeleted/g, '');
content = content.replace(/\|\| user\.isDeleted/g, '');

// Fix create
let createProfileCode = `      // 3. Insert Profile
      await this.userProfilesRepository.create(
        createdUserId,
        {
          firstName: dto.profile.firstName,
          lastName: dto.profile.lastName,
          displayName: dto.profile.displayName,
          phoneNumber: dto.profile.phoneNumber,
          jobTitle: dto.profile.jobTitle,
          organizationId: dto.profile.organizationId,
          businessUnitId: dto.profile.businessUnitId,
          departmentId: dto.profile.departmentId,
          sectionId: dto.profile.sectionId,
          vendorId: dto.profile.vendorId,
          createdBy: creatorUserId,
        },
        queryRunner,
      );`;

let newCreateUser = `        {
          employeeId: dto.employeeId,
          username: dto.username,
          email: dto.email,
          userType: dto.userType,
          isActive: false, // New users start in INVITED/inactive state
          adObjectId: dto.adObjectId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          mobileNo: dto.mobileNo,
          jobTitle: dto.jobTitle,
          orgUnitId: dto.orgUnitId,
          vendorId: dto.vendorId,
        }`;
content = content.replace(/\{\s*employeeId: dto\.employeeId,[\s\S]*?adObjectId: dto\.adObjectId,\s*\}/, newCreateUser);
content = content.replace(createProfileCode, '');

// Fix update
let updateProfileCode = `      // 2. Update Profile fields
      if (dto.profile) {
        await this.userProfilesRepository.update(
          userId,
          {
            ...dto.profile,
            updatedBy: updaterUserId,
          },
          queryRunner,
        );
      }`;
let newUpdateUser = `          {
            email: dto.email,
            username: dto.username,
            employeeId: dto.employeeId,
            userType: dto.userType,
            firstName: dto.firstName,
            lastName: dto.lastName,
            mobileNo: dto.mobileNo,
            jobTitle: dto.jobTitle,
            orgUnitId: dto.orgUnitId,
            vendorId: dto.vendorId,
          }`;
content = content.replace(/\{\s*email: dto\.email,[\s\S]*?userType: dto\.userType,\s*\}/, newUpdateUser);
content = content.replace(/if \(\s*dto\.email \|\|[\s\S]*?dto\.userType\s*\)\s*\{/, 'if (true) {');
content = content.replace(updateProfileCode, '');

// Fix isUserInScope
content = content.replace(/const targetDept = targetUser\.profile\?\.departmentId;\s*const targetBu = targetUser\.profile\?\.businessUnitId;\s*const targetSec = targetUser\.profile\?\.sectionId;/, 'const targetOrgUnit = targetUser.orgUnitId;');
content = content.replace(/if \(\!targetDept && \!targetBu && \!targetSec\)/, 'if (!targetOrgUnit)');
content = content.replace(/OR \(@2 IS NOT NULL AND v\.OrgUnitId = @2\)\s*OR \(@3 IS NOT NULL AND v\.OrgUnitId = @3\)/, '');
content = content.replace(/targetDept \|\| null,\s*targetBu \|\| null,\s*targetSec \|\| null,/, 'targetOrgUnit || null,');
fs.writeFileSync(svcPath, content);


// 2. user-validation.service.ts
let valPath = 'src/modules/authorization/users/services/user-validation.service.ts';
content = fs.readFileSync(valPath, 'utf8');

// Replace U7 signature and logic
let u7Old = `  async validateU7_OrgUnitReferences(
    profile?: {
      organizationId?: string | null;
      businessUnitId?: string | null;
      departmentId?: string | null;
      sectionId?: string | null;
    },
    qr?: QueryRunner,
  ): Promise<void> {
    if (!profile) return;

    const unitsToCheck = [
      { id: profile.organizationId, expectedType: 1, name: 'Organization' },
      { id: profile.businessUnitId, expectedType: 2, name: 'Business Unit' },
      { id: profile.departmentId, expectedType: 3, name: 'Department' },
      { id: profile.sectionId, expectedType: 4, name: 'Section' },
    ];`;
let u7New = `  async validateU7_OrgUnitReferences(
    orgUnitId?: string | null,
    qr?: QueryRunner,
  ): Promise<void> {
    if (!orgUnitId) return;

    const unitsToCheck = [
      { id: orgUnitId, expectedType: null, name: 'Org Unit' }, // We skip exact type check here since schema changed, or adjust if needed.
    ];`;
content = content.replace(u7Old, u7New);
content = content.replace(/if \(rows\[0\]\.OrgUnitTypeId !== unit\.expectedType\) \{[\s\S]*?\}\s*\}\s*\}/, '} }'); // Removing the type mismatch check since we don't have expectedType anymore based on a single generic OrgUnitID
content = content.replace(/validateU7_OrgUnitReferences\(dto\.profile, queryRunner\)/g, 'validateU7_OrgUnitReferences(dto.orgUnitId, queryRunner)');

fs.writeFileSync(valPath, content);


// 3. user-lifecycle.service.ts
let lifePath = 'src/modules/authorization/users/services/user-lifecycle.service.ts';
content = fs.readFileSync(lifePath, 'utf8');
content = content.replace(/\|\| user\.isDeleted/g, '');
fs.writeFileSync(lifePath, content);

console.log('Services updated');
