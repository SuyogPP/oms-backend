import re

service_path = "src/modules/authorization/vendor-users/services/vendor-users.service.ts"
with open(service_path, "r") as f: srv = f.read()

# Add AuditLogRepository import
if "AuditLogRepository" not in srv:
    srv = srv.replace("import { AuditService } from '../../../audit/service/audit.services';", "import { AuditService } from '../../../audit/service/audit.services';\nimport { AuditLogRepository } from '../../../audit/repositories/audit-log.repository';")
    srv = srv.replace("private readonly auditService: AuditService,", "private readonly auditService: AuditService,\n    private readonly auditLogRepository: AuditLogRepository,")

# Update validation for vendorId shape
# It's an INT now!
old_shape = """  private validateVendorIdShape(vendorId: string): void {
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(vendorId)) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.VENDOR_REQUIRED,
        message: `Invalid vendor ID shape [${vendorId}]. Must be a valid UUID.`,
      });
    }
  }"""
new_shape = """  private validateVendorIdShape(vendorId: number): void {
    if (!Number.isInteger(vendorId) || vendorId <= 0) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.VENDOR_REQUIRED,
        message: `Invalid vendor ID shape [${vendorId}]. Must be a positive integer.`,
      });
    }
  }"""
srv = srv.replace(old_shape, new_shape)

# Update deactivateAllByVendorId to number
srv = srv.replace("deactivateAllByVendorId(\n    vendorId: string,", "deactivateAllByVendorId(\n    vendorId: number,")

# Audit log in create
create_audit = """    await this.auditLogRepository.insert({
      table_name: 'tbl_Users',
      schema_name: 'auth',
      operation: 'INSERT',
      record_id_text: userId,
      performed_by: operatorUserId,
      source_module: 'authorization/vendor-users',
      new_values: JSON.stringify({ username: dto.username, email: dto.email, vendor_id: dto.vendorId }),
    });\n"""
if create_audit not in srv:
    srv = srv.replace("// 6. Security Event & Audit Logging", "// 6. Security Event & Audit Logging\n" + create_audit)

# Audit log in update
update_audit = """    await this.auditLogRepository.insert({
      table_name: 'tbl_Users',
      schema_name: 'auth',
      operation: 'UPDATE',
      record_id_text: id,
      performed_by: operatorUserId,
      source_module: 'authorization/vendor-users',
      old_values: JSON.stringify(existing),
      new_values: JSON.stringify(updated),
    });\n"""
if update_audit not in srv:
    srv = srv.replace("await this.securityEventsService.log('VENDOR_USER_UPDATED',", update_audit + "    await this.securityEventsService.log('VENDOR_USER_UPDATED',")

# Audit log in deactivate
deactivate_audit = """    await this.auditLogRepository.insert({
      table_name: 'tbl_Users',
      schema_name: 'auth',
      operation: 'UPDATE',
      record_id_text: id,
      performed_by: operatorUserId,
      source_module: 'authorization/vendor-users',
      old_values: JSON.stringify(existing),
      new_values: JSON.stringify({ ...existing, isActive: false }),
    });\n"""
if deactivate_audit not in srv:
    srv = srv.replace("await this.securityEventsService.log('VENDOR_USER_DEACTIVATED',", deactivate_audit + "    await this.securityEventsService.log('VENDOR_USER_DEACTIVATED',")

# Audit log in deactivateAllByVendorId
deactivate_all_audit = """    await this.auditLogRepository.insert({
      table_name: 'tbl_Users',
      schema_name: 'auth',
      operation: 'UPDATE',
      record_id_text: `VENDOR-${vendorId}`,
      performed_by: operatorUserId,
      source_module: 'authorization/vendor-users',
      new_values: JSON.stringify({ isActive: false, vendor_id: vendorId }),
    });\n"""
if deactivate_all_audit not in srv:
    srv = srv.replace("await this.securityEventsService.log('VENDOR_DEACTIVATED_CASCADE',", deactivate_all_audit + "    await this.securityEventsService.log('VENDOR_DEACTIVATED_CASCADE',")

with open(service_path, "w") as f: f.write(srv)


spec_path = "src/modules/authorization/vendor-users/services/vendor-users.service.spec.ts"
with open(spec_path, "r") as f: spec = f.read()
if "mockAuditLogRepository" not in spec:
    mock = """  const mockAuditLogRepository = { insert: jest.fn().mockResolvedValue(null) };\n"""
    spec = spec.replace("  const mockAuditService = {", mock + "  const mockAuditService = {")
    spec = spec.replace("{ provide: AuditService, useValue: mockAuditService },", "{ provide: AuditService, useValue: mockAuditService },\n        { provide: AuditLogRepository, useValue: mockAuditLogRepository },")
    spec = "import { AuditLogRepository } from '../../../audit/repositories/audit-log.repository';\n" + spec

spec = spec.replace("'1053433E-F36B-1410-85ED-009A959FB122'", "101")
spec = spec.replace("vendorId: 'INVALID_VENDOR',", "vendorId: -1,")
spec = spec.replace("vendorId: 'vendor-id-1',", "vendorId: 101,")
spec = spec.replace("vendorId: 'vendor-id-2',", "vendorId: 102,")

with open(spec_path, "w") as f: f.write(spec)

print("Service and Spec patched")
