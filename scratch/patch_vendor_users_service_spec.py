import re

spec_path = "src/modules/authorization/vendor-users/services/vendor-users.service.spec.ts"
with open(spec_path, "r") as f: spec = f.read()
if "mockAuditLogRepository" not in spec:
    mock = """  const mockAuditLogRepository = { insert: jest.fn().mockResolvedValue(null) };\n"""
    spec = spec.replace("  const mockAuditService = {", mock + "  const mockAuditService = {")
    spec = spec.replace("{ provide: AuditService, useValue: mockAuditService },", "{ provide: AuditService, useValue: mockAuditService },\n        { provide: AuditLogRepository, useValue: mockAuditLogRepository },")
    spec = "import { AuditLogRepository } from '../../../audit/repositories/audit-log.repository';\n" + spec

spec = spec.replace("'2053433E-F36B-1410-85ED-009A959FB233'", "102")
spec = spec.replace("expect(mockValidationService.validateV2_VendorLink).toHaveBeenCalledWith(\n        vendorId,\n      );", "expect(mockValidationService.validateV2_VendorLink).toHaveBeenCalledWith(\n        vendorId.toString(),\n      );")
spec = spec.replace("vendorId: 'not-a-valid-uuid',", "vendorId: -1,")
spec = spec.replace("vendorId: 'invalid-uuid'", "vendorId: -1")
spec = spec.replace("invalid vendorId UUID format", "invalid vendorId shape")
spec = spec.replace("expect(mockValidationService.validateV5_VendorOrgUnitProfile,).toHaveBeenCalledWith(USER_TYPES.VENDOR, {});", "expect(mockValidationService.validateV5_VendorOrgUnitProfile).toHaveBeenCalledWith(USER_TYPES.VENDOR, null);")
spec = spec.replace("expect(\n        mockValidationService.validateV5_VendorOrgUnitProfile,\n      ).toHaveBeenCalledWith(USER_TYPES.VENDOR, {});", "expect(\n        mockValidationService.validateV5_VendorOrgUnitProfile,\n      ).toHaveBeenCalledWith(USER_TYPES.VENDOR, null);")

with open(spec_path, "w") as f: f.write(spec)

print("Spec patched")
