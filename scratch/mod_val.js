const fs = require('fs');

const pathVal = '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/users/services/user-validation.service.ts';
let valContent = fs.readFileSync(pathVal, 'utf8');

valContent = valContent.replace(/private async validateU7_OrgUnitReferences\([\s\S]*?qr\?: QueryRunner,\s*\):\s*Promise<void> \{[\s\S]*?\}\.filter\(\(r\) => r\.id\);/, `private async validateU7_OrgUnitReferences(
    dto?: { orgUnitId?: string },
    qr?: QueryRunner,
  ): Promise<void> {
    if (!dto || !dto.orgUnitId) return;

    const references = [
      { id: dto.orgUnitId, expectedType: null, name: 'Organization' },
    ].filter((r) => r.id);`);

valContent = valContent.replace(/private validateV5_VendorOrgUnitProfile\([\s\S]*?\): void \{[\s\S]*?if \(userType === USER_TYPES\.VENDOR && [^]*?\{[\s\S]*?throw new BadRequestException\(\{[\s\S]*?\}\);\s*\}\s*\}\s*\}/, `private validateV5_VendorOrgUnitProfile(
    userType: UserType,
    dto?: { orgUnitId?: string },
  ): void {
    if (userType === USER_TYPES.VENDOR && dto && dto.orgUnitId) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.VENDOR_ORG_UNIT_NOT_ALLOWED,
        message: 'Vendor users must not be assigned to internal organizational units.',
      });
    }
  }`);

valContent = valContent.replace(/this\.validateV5_VendorOrgUnitProfile\(dto\.userType,\s*dto\.profile\);/g, 'this.validateV5_VendorOrgUnitProfile(dto.userType, dto);');
valContent = valContent.replace(/await this\.validateU7_OrgUnitReferences\(dto\.profile,\s*qr\);/g, 'await this.validateU7_OrgUnitReferences(dto, qr);');
valContent = valContent.replace(/dto\.profile\?\.departmentId,/g, 'dto.orgUnitId,');
valContent = valContent.replace(/if \(dto\.profile\) \{/g, 'if (dto) {');

fs.writeFileSync(pathVal, valContent);

const pathMod = '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/users/users.module.ts';
let modContent = fs.readFileSync(pathMod, 'utf8');
modContent = modContent.replace(/import \{ UserProfilesRepository \} from '\.\/repositories\/user-profiles\.repository';\n/, '');
modContent = modContent.replace(/\s*UserProfilesRepository,\n/g, '\n');
fs.writeFileSync(pathMod, modContent);

const pathLife = '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/users/services/user-lifecycle.service.ts';
if (fs.existsSync(pathLife)) {
  let lifeContent = fs.readFileSync(pathLife, 'utf8');
  // Check if anything needs updating
}

console.log('Validation and Module updated');
