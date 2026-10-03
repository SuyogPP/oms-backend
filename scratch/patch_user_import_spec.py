import re

filepath = "src/modules/authorization/user-import/services/user-import.service.spec.ts"
with open(filepath, "r") as f: content = f.read()

if "mockAuditLogRepository" not in content:
    mock = """
  const mockAuditLogRepository = {
    insert: jest.fn().mockResolvedValue(null),
  };
"""
    content = content.replace("  const mockSecurityEventsService = {", mock + "  const mockSecurityEventsService = {")
    content = content.replace(
        "{ provide: AuditService, useValue: mockAuditService },",
        "{ provide: AuditService, useValue: mockAuditService },\n        { provide: AuditLogRepository, useValue: mockAuditLogRepository },"
    )
    content = "import { AuditLogRepository } from '../../audit/repositories/audit-log.repository';\n" + content
    with open(filepath, "w") as f: f.write(content)
print("User import spec patched")
