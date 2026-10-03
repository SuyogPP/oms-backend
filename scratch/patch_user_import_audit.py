import re

filepath = "src/modules/authorization/user-import/services/user-import.service.ts"
with open(filepath, "r") as f: content = f.read()

if "AuditLogRepository" not in content:
    content = content.replace(
        "import { AuditService } from '../../audit/services/audit.service';",
        "import { AuditService } from '../../audit/services/audit.service';\nimport { AuditLogRepository } from '../../audit/repositories/audit-log.repository';"
    )
    content = content.replace(
        "private readonly auditService: AuditService,",
        "private readonly auditService: AuditService,\n    private readonly auditLogRepository: AuditLogRepository,"
    )
    
    # 1. Audit User Insert
    user_insert_end = "          [row.username, row.email, row.employeeId || null, row.firstName, row.lastName, row.jobTitle || null, row.departmentId || null],\n        );"
    audit_user = """
        await this.auditLogRepository.insert({
          table_name: 'tbl_Users',
          schema_name: 'auth',
          operation: 'INSERT',
          record_id_text: userId,
          performed_by: operatorUserId,
          source_module: 'authorization/user-import',
          new_values: JSON.stringify({ username: row.username, email: row.email, employee_id: row.employeeId, first_name: row.firstName, last_name: row.lastName }),
        });"""
    content = content.replace(user_insert_end, user_insert_end + audit_user)
    
    # 2. Audit Invitation Insert
    inv_insert_end = "          [userId, tokenHash, expiresAt],\n        );"
    audit_inv = """
        await this.auditLogRepository.insert({
          table_name: 'tbl_User_Invitations',
          schema_name: 'auth',
          operation: 'INSERT',
          record_id_text: userId,
          performed_by: operatorUserId,
          source_module: 'authorization/user-import',
          new_values: JSON.stringify({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt }),
        });"""
    content = content.replace(inv_insert_end, inv_insert_end + audit_inv)
    
    # 3. Audit Role Insert
    role_insert_end = "              [userId, roleId, operatorUserId || null, row.scopeOrgUnitId || null],\n            );"
    audit_role = """
            await this.auditLogRepository.insert({
              table_name: 'tbl_User_Roles',
              schema_name: 'auth',
              operation: 'INSERT',
              record_id_text: userId,
              performed_by: operatorUserId,
              source_module: 'authorization/user-import',
              new_values: JSON.stringify({ user_id: userId, role_id: roleId, org_unit_id: row.scopeOrgUnitId }),
            });"""
    content = content.replace(role_insert_end, role_insert_end + audit_role)

    with open(filepath, "w") as f: f.write(content)
print("User import service audit logs patched")
