filepath = "src/modules/authorization/user-import/services/user-import.service.spec.ts"
with open(filepath, "r") as f: content = f.read()

# Fix the first test
content = content.replace(
    ".mockResolvedValueOnce([{ userId: 'created-user-id-1' }]) // insert user\n        .mockResolvedValueOnce([]) // insert profile\n        .mockResolvedValueOnce([]); // insert invitation",
    ".mockResolvedValueOnce([{ userId: 'created-user-id-1' }]) // insert user\n        .mockResolvedValueOnce([]); // insert invitation"
)

# And clear the mocks in beforeEach just in case
content = content.replace(
    "service = module.get<UserImportService>(UserImportService);",
    "service = module.get<UserImportService>(UserImportService);\n    mockQueryRunner.query.mockReset();\n    mockQueryRunner.query.mockResolvedValue([]);"
)

with open(filepath, "w") as f: f.write(content)
print("Mock fixed")
