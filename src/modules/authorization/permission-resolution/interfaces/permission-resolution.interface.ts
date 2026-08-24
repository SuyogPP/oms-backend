import { PermissionSourceType } from '../permission-resolution.constants';

export interface EffectivePermissionItem {
  code: string;
  source: PermissionSourceType;
  via?: string;
  reason?: string;
  until?: string | null;
}

export interface RevokedPermissionItem {
  code: string;
  source: 'OVERRIDE_REVOKE';
  reason?: string;
}

export interface EffectivePermissionsResponse {
  permissions: EffectivePermissionItem[];
  revoked: RevokedPermissionItem[];
}

export interface RoleResolutionItem {
  roleId: string;
  roleCode: string;
  roleName: string;
  depth: number;
  inheritedVia?: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
}

export interface RawPermissionRow {
  roleId: string;
  roleCode: string;
  permissionId: string;
  permissionCode: string;
  moduleName: string;
  actionName: string;
  depth: number;
  inheritedVia?: string;
}

export interface RawOverrideRow {
  overrideId: string;
  userId: string;
  permissionId: string;
  permissionCode: string;
  isGranted: boolean;
  reason?: string;
  approvedBy?: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
}

export interface RawDelegationRow {
  delegationId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  permissionCode?: string;
}
