import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IUserRoleAssignment,
  IAssignRoleData,
} from '../interfaces/user-assignments.interface';

@Injectable()
export class UserRolesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Retrieves all role assignments (active and inactive) for a user.
   */
  async findByUserId(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IUserRoleAssignment[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          ur.user_role_id AS userRoleId,
          ur.user_id AS userId,
          ur.role_id AS roleId,
          r.role_code AS roleCode,
          r.role_name AS roleName,
          r.is_system_role AS isSystemRole,
          ur.effective_from AS effectiveFrom,
          ur.effective_to AS effectiveTo,
          ur.is_active AS isActive,
          ur.assigned_by AS assignedBy,
          ur.assigned_at AS assignedAt
      FROM [auth].tbl_User_Roles] ur
      INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id
      WHERE ur.user_id = @0
      ORDER BY ur.effective_from DESC;
      `,
      [userId],
    );

    return rows.map((r: any) => ({
      userRoleId: r.userRoleId,
      userId: r.userId,
      roleId: r.roleId,
      roleCode: r.roleCode,
      roleName: r.roleName,
      isSystemRole: r.isSystemRole === 1 || r.isSystemRole === true,
      effectiveFrom: new Date(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
      isActive: r.isActive === 1 || r.isActive === true,
      assignedBy: r.assignedBy,
      assignedAt: new Date(r.assignedAt || r.effectiveFrom),
    }));
  }

  /**
   * Retrieves active temporal role assignments for a user.
   */
  async findActiveByUserId(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IUserRoleAssignment[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          ur.user_role_id AS userRoleId,
          ur.user_id AS userId,
          ur.role_id AS roleId,
          r.role_code AS roleCode,
          r.role_name AS roleName,
          r.is_system_role AS isSystemRole,
          ur.effective_from AS effectiveFrom,
          ur.effective_to AS effectiveTo,
          ur.is_active AS isActive,
          ur.assigned_by AS assignedBy,
          ur.assigned_at AS assignedAt
      FROM [auth].tbl_User_Roles] ur
      INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id
      WHERE ur.user_id = @0
        AND ur.is_active = 1
        AND r.is_active = 1
        AND ur.effective_from <= SYSUTCDATETIME()
        AND (ur.effective_to IS NULL OR ur.effective_to > SYSUTCDATETIME())
      ORDER BY ur.effective_from DESC;
      `,
      [userId],
    );

    return rows.map((r: any) => ({
      userRoleId: r.userRoleId,
      userId: r.userId,
      roleId: r.roleId,
      roleCode: r.roleCode,
      roleName: r.roleName,
      isSystemRole: r.isSystemRole === 1 || r.isSystemRole === true,
      effectiveFrom: new Date(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
      isActive: r.isActive === 1 || r.isActive === true,
      assignedBy: r.assignedBy,
      assignedAt: new Date(r.assignedAt || r.effectiveFrom),
    }));
  }

  /**
   * Finds a user role assignment by UserRoleID.
   */
  async findById(
    userRoleId: string,
    qr?: QueryRunner,
  ): Promise<IUserRoleAssignment | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          ur.user_role_id AS userRoleId,
          ur.user_id AS userId,
          ur.role_id AS roleId,
          r.role_code AS roleCode,
          r.role_name AS roleName,
          r.is_system_role AS isSystemRole,
          ur.effective_from AS effectiveFrom,
          ur.effective_to AS effectiveTo,
          ur.is_active AS isActive,
          ur.assigned_by AS assignedBy,
          ur.assigned_at AS assignedAt
      FROM [auth].tbl_User_Roles] ur
      INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id
      WHERE ur.user_role_id = @0;
      `,
      [userRoleId],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      userRoleId: r.userRoleId,
      userId: r.userId,
      roleId: r.roleId,
      roleCode: r.roleCode,
      roleName: r.roleName,
      isSystemRole: r.isSystemRole === 1 || r.isSystemRole === true,
      effectiveFrom: new Date(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
      isActive: r.isActive === 1 || r.isActive === true,
      assignedBy: r.assignedBy,
      assignedAt: new Date(r.assignedAt || r.effectiveFrom),
    };
  }

  /**
   * Assigns a role to a user.
   */
  async assignRole(data: IAssignRoleData, qr?: QueryRunner): Promise<string> {
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].tbl_User_Roles] (
          UserRoleID,
          UserID,
          RoleID,
          EffectiveFrom,
          EffectiveTo,
          IsActive,
          AssignedBy,
          AssignedAt
      )
      OUTPUT INSERTED.user_role_id AS userRoleId
      VALUES (
          NEWID(),
          @0,
          @1,
          COALESCE(@2, SYSUTCDATETIME()),
          @3,
          1,
          @4,
          SYSUTCDATETIME()
      );
      `,
      [
        data.userId,
        data.roleId,
        data.effectiveFrom || null,
        data.effectiveTo || null,
        data.assignedBy || null,
      ],
    );

    return rows[0].userRoleId;
  }

  /**
   * Revokes a role assignment by setting EffectiveTo = SYSUTCDATETIME().
   *
   * Note on Section 4.2: Revocation does NOT set IsActive = 0.
   * IsActive is reserved for administrative suspension of an assignment that
   * should later resume. Ending an assignment sets EffectiveTo = now.
   */
  async revokeRole(userRoleId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].tbl_User_Roles]
      SET effective_to = SYSUTCDATETIME()
      WHERE user_role_id = @0;
      `,
      [userRoleId],
    );
  }

  /**
   * Ends all active role assignments for a user (used during user deletion).
   */
  async revokeAllForUser(userId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].tbl_User_Roles]
      SET 
          IsActive = 0,
          EffectiveTo = SYSUTCDATETIME()
      WHERE user_id = @0
        AND is_active = 1
        AND (EffectiveTo IS NULL OR effective_to > SYSUTCDATETIME());
      `,
      [userId],
    );
  }

  /**
   * Checks if user has an active role matching roleCode.
   */
  async hasActiveRole(
    userId: string,
    roleCode: string,
    qr?: QueryRunner,
  ): Promise<boolean> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP 1 1 AS hasRole
      FROM [auth].tbl_User_Roles] ur
      INNER JOIN [auth].tbl_Roles] r ON r.role_id = ur.role_id
      WHERE ur.user_id = @0
        AND r.role_code = @1
        AND ur.is_active = 1
        AND r.is_active = 1
        AND ur.effective_from <= SYSUTCDATETIME()
        AND (ur.effective_to IS NULL OR ur.effective_to > SYSUTCDATETIME());
      `,
      [userId, roleCode],
    );

    return rows && rows.length > 0;
  }

  /**
   * Retrieves all active roles in the system.
   */
  async findAllRoles(qr?: QueryRunner): Promise<
    Array<{
      roleId: string;
      roleCode: string;
      roleName: string;
      description?: string;
      isSystemRole: boolean;
      isActive: boolean;
    }>
  > {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          RoleID AS roleId,
          RoleCode AS roleCode,
          RoleName AS roleName,
          Description AS description,
          IsSystemRole AS isSystemRole,
          IsActive AS isActive
      FROM [auth].tbl_Roles]
      WHERE is_active = 1
      ORDER BY role_name ASC;
      `,
    );

    return rows.map((r: any) => ({
      roleId: r.roleId,
      roleCode: r.roleCode,
      roleName: r.roleName,
      description: r.description,
      isSystemRole: r.isSystemRole === 1 || r.isSystemRole === true,
      isActive: r.isActive === 1 || r.isActive === true,
    }));
  }

  /**
   * Finds a role by its UUID or RoleCode.
   */
  async findRoleByIdOrCode(
    identifier: string,
    qr?: QueryRunner,
  ): Promise<{
    roleId: string;
    roleCode: string;
    roleName: string;
    description?: string;
    isSystemRole: boolean;
    isActive: boolean;
  } | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          RoleID AS roleId,
          RoleCode AS roleCode,
          RoleName AS roleName,
          Description AS description,
          IsSystemRole AS isSystemRole,
          IsActive AS isActive
      FROM [auth].tbl_Roles]
      WHERE (CAST(RoleID AS NVARCHAR(50)) = @0 OR LOWER(RoleCode) = LOWER(@0))
        AND is_active = 1;
      `,
      [identifier],
    );

    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      roleId: r.roleId,
      roleCode: r.roleCode,
      roleName: r.roleName,
      description: r.description,
      isSystemRole: r.isSystemRole === 1 || r.isSystemRole === true,
      isActive: r.isActive === 1 || r.isActive === true,
    };
  }
}
