const fs = require('fs');

const pathRepo = '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/users/repositories/users.repository.ts';
let repoContent = fs.readFileSync(pathRepo, 'utf8');

repoContent = repoContent.replace(/p\.UserProfileID AS userProfileId,[\s\S]*?p\.SectionID AS sectionId,[\s\S]*?CAST\(NULL AS UNIQUEIDENTIFIER\) AS vendorId,/g, `u.FirstName AS firstName,
          u.LastName AS lastName,
          u.MobileNo AS mobileNo,
          u.JobTitle AS jobTitle,
          CAST(u.OrgUnitID AS VARCHAR(50)) AS orgUnitId,
          u.VendorID AS vendorId,`);

repoContent = repoContent.replace(/u\.IsDeleted AS isDeleted,\s*u\.DeletedAt AS deletedAt,\s*u\.DeletedBy AS deletedBy,\s*/g, '');
repoContent = repoContent.replace(/u\.LastFailedLoginAt AS lastFailedLoginAt,/g, '');
repoContent = repoContent.replace(/LEFT JOIN \[auth\]\.\[UserProfiles\] p ON p\.UserID = u\.UserID/g, '');
repoContent = repoContent.replace(/AND u\.IsDeleted = 0/g, '');
repoContent = repoContent.replace(/WHERE u\.IsDeleted = 0;/g, 'WHERE 1=1;');
repoContent = repoContent.replace(/WHERE u\.IsDeleted = 0/g, 'WHERE 1=1');
repoContent = repoContent.replace(/AND IsDeleted = 0/g, '');
repoContent = repoContent.replace(/RTRIM\(LTRIM\(p\.FirstName \+ ' ' \+ ISNULL\(p\.LastName, ''\)\)\) AS displayName,/g, '');

// Fix search
repoContent = repoContent.replace(/LOWER\(p\.FirstName\) LIKE LOWER/g, 'LOWER(u.FirstName) LIKE LOWER');
repoContent = repoContent.replace(/LOWER\(p\.LastName\) LIKE LOWER/g, 'LOWER(u.LastName) LIKE LOWER');

// Fix departmentId etc in findAll
repoContent = repoContent.replace(/p\.DepartmentID/g, 'u.OrgUnitID');
repoContent = repoContent.replace(/p\.BusinessUnitID/g, 'u.OrgUnitID');
repoContent = repoContent.replace(/p\.SectionID/g, 'u.OrgUnitID');
repoContent = repoContent.replace(/firstName: 'p\.FirstName',/g, "firstName: 'u.FirstName',");
repoContent = repoContent.replace(/lastName: 'p\.LastName',/g, "lastName: 'u.LastName',");

fs.writeFileSync(pathRepo, repoContent);

const pathSvc = '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/users/services/users.service.ts';
let svcContent = fs.readFileSync(pathSvc, 'utf8');
svcContent = svcContent.replace(/import \{ UserProfilesRepository \} from '\.\.\/repositories\/user-profiles\.repository';\n/, '');
svcContent = svcContent.replace(/private readonly userProfilesRepository: UserProfilesRepository,\n\s*/, '');

svcContent = svcContent.replace(/\/\/ 3\. Insert Profile\s*await this\.userProfilesRepository\.create\([\s\S]*?queryRunner,\s*\);/g, '');

svcContent = svcContent.replace(/employeeId: dto\.employeeId,\n\s*username: dto\.username,\n\s*email: dto\.email,\n\s*userType: dto\.userType,\n\s*isActive: false,[\s\S]*?adObjectId: dto\.adObjectId,/, 
`employeeId: dto.employeeId,
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
          vendorId: dto.vendorId,`);

svcContent = svcContent.replace(/\/\/ 2\. Update Profile fields[\s\S]*?if \(dto\.profile\) \{[\s\S]*?this\.userProfilesRepository\.update\([\s\S]*?\}\n/, '');
svcContent = svcContent.replace(/await this\.usersRepository\.update\([\s\S]*?\{[\s\S]*?email: dto\.email,\n\s*username: dto\.username,\n\s*employeeId: dto\.employeeId,\n\s*userType: dto\.userType,\n\s*\}/, 
`await this.usersRepository.update(
          userId,
          {
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
          }`);

svcContent = svcContent.replace(/if \([\s\S]*?dto\.userType\n\s*\) \{/g, `if (true) {`);

fs.writeFileSync(pathSvc, svcContent);

console.log('Modified repo and service');
