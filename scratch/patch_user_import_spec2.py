import re

filepath = "src/modules/authorization/user-import/services/user-import.service.spec.ts"
with open(filepath, "r") as f: content = f.read()

if "mockDataSource" not in content:
    mock = """
  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    }),
  };
"""
    content = content.replace("  const mockAuditLogRepository = {", mock + "  const mockAuditLogRepository = {")
    content = content.replace(
        "{ provide: AuditLogRepository, useValue: mockAuditLogRepository },",
        "{ provide: AuditLogRepository, useValue: mockAuditLogRepository },\n        { provide: DataSource, useValue: mockDataSource },"
    )
    with open(filepath, "w") as f: f.write(content)
print("User import spec DataSource mock added")
