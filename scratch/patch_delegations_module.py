import re

filepath = "src/modules/authorization/delegations/delegations.module.ts"
with open(filepath, "r") as f: content = f.read()

if "OrganizationModule" not in content:
    content = content.replace(
        "import { AuditModule } from '../../audit/audit.module';",
        "import { AuditModule } from '../../audit/audit.module';\nimport { OrganizationModule } from '../../organization/organization.module';"
    )
    content = content.replace(
        "AuditModule,",
        "AuditModule,\n    forwardRef(() => OrganizationModule),"
    )
    with open(filepath, "w") as f: f.write(content)

spec_filepath = "src/modules/authorization/delegations/services/delegations.service.spec.ts"
with open(spec_filepath, "r") as f: spec_content = f.read()

if "mockOrgScopeRepository" not in spec_content:
    mock = """
  const mockOrgScopeRepository = {
    getVisibleOrgUnitIds: jest.fn().mockResolvedValue([100, 200, 300]),
  };
  const mockAuditLogRepository = {
    insert: jest.fn().mockResolvedValue(null),
  };
"""
    spec_content = spec_content.replace("  const mockSecurityEventsService = {", mock + "  const mockSecurityEventsService = {")
    spec_content = spec_content.replace(
        "{ provide: AuditService, useValue: mockAuditService },",
        "{ provide: AuditService, useValue: mockAuditService },\n        { provide: OrgScopeRepository, useValue: mockOrgScopeRepository },\n        { provide: AuditLogRepository, useValue: mockAuditLogRepository },"
    )
    spec_content = "import { OrgScopeRepository } from '../../../organization/org-scope/repositories/org-scope.repository';\nimport { AuditLogRepository } from '../../../audit/repositories/audit-log.repository';\n" + spec_content
    with open(spec_filepath, "w") as f: f.write(spec_content)

print("Delegations module and specs patched")
