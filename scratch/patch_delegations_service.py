import re

filepath = "src/modules/authorization/delegations/services/delegations.service.ts"
with open(filepath, "r") as f: content = f.read()

# 1. Inject OrgScopeRepository and AuditLogRepository
if "OrgScopeRepository" not in content:
    content = content.replace("import { DelegationsRepository } from '../repositories/delegations.repository';", "import { DelegationsRepository } from '../repositories/delegations.repository';\nimport { OrgScopeRepository } from '../../../organization/org-scope/repositories/org-scope.repository';\nimport { AuditLogRepository } from '../../../audit/repositories/audit-log.repository';")
    content = content.replace("private readonly delegationsRepository: DelegationsRepository,", "private readonly delegationsRepository: DelegationsRepository,\n    private readonly orgScopeRepository: OrgScopeRepository,\n    private readonly auditLogRepository: AuditLogRepository,")

# 2. Rewrite enforceScopeVisibility
new_scope = """  private async enforceScopeVisibility(
    targetUserId: string,
    requesterUserId: string,
    targetUser: any,
  ): Promise<void> {
    const globalCheck = await this.dataSource.query(
      `SELECT 1 FROM [auth].tbl_User_Roles] ur 
       INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id 
       WHERE ur.user_id = @0 AND ur.is_active = 1 AND (ur.org_unit_id IS NULL OR r.role_code = 'SYSTEM_ADMIN')`,
      [requesterUserId]
    );

    if (globalCheck && globalCheck.length > 0) {
      return;
    }

    const deptId = targetUser.orgUnitId || targetUser.profile?.departmentId;
    if (!deptId) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${targetUserId}] not found.`,
      });
    }

    const visibleIds = await this.orgScopeRepository.getVisibleOrgUnitIds(requesterUserId);
    
    if (!visibleIds.includes(deptId)) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${targetUserId}] not found.`,
      });
    }
  }"""

content = re.sub(r"  private async enforceScopeVisibility\([\s\S]*?\}\n", new_scope + "\n", content)

# 3. Add AuditLogRepository inserts
def add_audit_create(m):
    return m.group(0) + """\n    await this.auditLogRepository.insert({
      table_name: 'tbl_Delegations',
      schema_name: 'auth',
      operation: 'INSERT',
      record_id_text: delegationId,
      performed_by: operatorUserId || fromUserId,
      source_module: 'authorization/delegations',
      new_values: JSON.stringify({ fromUserId, toUserId: dto.toUserId, startDate, endDate, reason: dto.reason }),
    });\n"""
content = re.sub(r"(const delegationId = await this\.delegationsRepository\.create\(\{[\s\S]*?\}\);)", add_audit_create, content)

def add_audit_update(m):
    return m.group(0) + """\n    await this.auditLogRepository.insert({
      table_name: 'tbl_Delegations',
      schema_name: 'auth',
      operation: 'UPDATE',
      record_id_text: delegationId,
      performed_by: operatorUserId,
      source_module: 'authorization/delegations',
      old_values: JSON.stringify(delegation),
      new_values: JSON.stringify({ ...delegation, endDate: dto.endDate || delegation.endDate, reason: dto.reason || delegation.reason, isActive: dto.isActive !== undefined ? dto.isActive : delegation.isActive }),
    });\n"""
content = re.sub(r"(await this\.delegationsRepository\.update\(delegationId, dto\);)", add_audit_update, content)

def add_audit_cancel(m):
    return m.group(0) + """\n    await this.auditLogRepository.insert({
      table_name: 'tbl_Delegations',
      schema_name: 'auth',
      operation: 'UPDATE',
      record_id_text: delegationId,
      performed_by: operatorUserId,
      source_module: 'authorization/delegations',
      old_values: JSON.stringify(delegation),
      new_values: JSON.stringify({ ...delegation, isActive: false }),
    });\n"""
content = re.sub(r"(await this\.delegationsRepository\.cancel\(delegationId\);)", add_audit_cancel, content)

with open(filepath, "w") as f: f.write(content)
print("Delegations service patched")
