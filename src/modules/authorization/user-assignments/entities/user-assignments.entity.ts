import { ApiProperty } from '@nestjs/swagger';
import {
  IUserRoleAssignment,
  IUserScopeAssignment,
  IUserOverrideAssignment,
} from '../interfaces/user-assignments.interface';

export class UserRoleEntity implements IUserRoleAssignment {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userRoleId!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userId!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  roleId!: string;

  @ApiProperty({ example: 'HOD' })
  roleCode!: string;

  @ApiProperty({ example: 'Head of Department' })
  roleName!: string;

  @ApiProperty({ example: false })
  isSystemRole!: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  effectiveFrom!: Date;

  @ApiProperty({ example: null, required: false })
  effectiveTo?: Date | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  assignedBy?: string | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  assignedAt!: Date;
}

export class UserScopeEntity implements IUserScopeAssignment {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userOrganizationScopeId!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userId!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  scopeDefinitionId!: string;

  @ApiProperty({ example: 'DEPARTMENT' })
  scopeCode!: string;

  @ApiProperty({ example: 'Department Scope' })
  scopeName!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  orgUnitId?: string | null;

  @ApiProperty({ example: 'Finance Department', required: false })
  orgUnitName?: string | null;

  @ApiProperty({ example: 'DEP-FIN', required: false })
  orgUnitCode?: string | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', required: false })
  effectiveFrom?: Date | null;

  @ApiProperty({ example: null, required: false })
  effectiveTo?: Date | null;

  @ApiProperty({ example: true, required: false })
  isActive?: boolean;
}

export class UserOverrideEntity implements IUserOverrideAssignment {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userPermissionOverrideId!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userId!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  permissionId!: string;

  @ApiProperty({ example: 'REQUISITION.APPROVE' })
  permissionCode!: string;

  @ApiProperty({ example: 'REQUISITION' })
  moduleName!: string;

  @ApiProperty({ example: 'APPROVE' })
  actionName!: string;

  @ApiProperty({ example: true })
  isGranted!: boolean;

  @ApiProperty({ example: 'Special project authorization', required: false })
  reason?: string | null;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  approvedBy?: string | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  effectiveFrom!: Date;

  @ApiProperty({ example: '2026-09-30T00:00:00.000Z', required: false })
  effectiveTo?: Date | null;
}
