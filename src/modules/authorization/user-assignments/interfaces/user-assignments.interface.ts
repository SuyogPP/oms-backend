export interface IUserRoleAssignment {
  userRoleId: string;
  userId: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  isSystemRole: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;
  assignedBy?: string | null;
  assignedAt: Date;
}

export interface IUserScopeAssignment {
  userOrganizationScopeId: string;
  userId: string;
  scopeDefinitionId: string;
  scopeCode: string;
  scopeName: string;
  orgUnitId?: string | null;
  organizationId?: string | null;
  businessUnitId?: string | null;
  departmentId?: string | null;
  sectionId?: string | null;
  orgUnitName?: string | null;
  orgUnitCode?: string | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  isActive?: boolean;
}

export interface IUserOverrideAssignment {
  userPermissionOverrideId: string;
  userId: string;
  permissionId: string;
  permissionCode: string;
  moduleName: string;
  actionName: string;
  isGranted: boolean;
  reason?: string | null;
  approvedBy?: string | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
}

export interface IAssignRoleData {
  userId: string;
  roleId: string;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  assignedBy?: string;
}

export interface IAssignScopeData {
  userId: string;
  scopeDefinitionId: string;
  orgUnitId?: string | null;
  organizationId?: string | null;
  businessUnitId?: string | null;
  departmentId?: string | null;
  sectionId?: string | null;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  isActive?: boolean;
}

export interface IManageOverrideData {
  userId: string;
  permissionId: string;
  isGranted: boolean;
  reason?: string;
  approvedBy?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
}
