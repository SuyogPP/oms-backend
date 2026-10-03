filepath = "src/modules/authorization/user-import/services/user-import.service.ts"
with open(filepath, "r") as f: content = f.read()

bad_audit = """        await this.auditLogRepository.insert({
          table_name: 'tbl_Users',
          schema_name: 'auth',
          operation: 'INSERT',
          record_id_text: userId,
          performed_by: operatorUserId,
          source_module: 'authorization/user-import',
          new_values: JSON.stringify({ username: row.username, email: row.email, employee_id: row.employeeId, first_name: row.firstName, last_name: row.lastName }),
        });"""
content = content.replace(bad_audit, "")
# now put it AFTER "const userId = userRows[0].userId;"
content = content.replace(
    "const userId = userRows[0].userId;",
    "const userId = userRows[0].userId;\n" + bad_audit
)

with open(filepath, "w") as f: f.write(content)
print("User import audit fixed")
