import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IUserOverrideAssignment,
  IManageOverrideData,
} from '../interfaces/user-assignments.interface';

@Injectable()
export class UserOverridesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Retrieves all overrides for a user.
   */
  async findByUserId(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IUserOverrideAssignment[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          upo.UserPermissionOverrideID AS userPermissionOverrideId,
          upo.UserID AS userId,
          upo.PermissionID AS permissionId,
          p.PermissionCode AS permissionCode,
          p.ModuleName AS moduleName,
          p.ActionName AS actionName,
          upo.IsGranted AS isGranted,
          upo.Reason AS reason,
          upo.ApprovedBy AS approvedBy,
          upo.EffectiveFrom AS effectiveFrom,
          upo.EffectiveTo AS effectiveTo
      FROM [auth].[UserPermissionOverrides] upo
      INNER JOIN [auth].[Permissions] p ON p.PermissionID = upo.PermissionID
      WHERE upo.UserID = @0
      ORDER BY upo.EffectiveFrom DESC;
      `,
      [userId],
    );

    return rows.map((r: any) => ({
      userPermissionOverrideId: r.userPermissionOverrideId,
      userId: r.userId,
      permissionId: r.permissionId,
      permissionCode: r.permissionCode,
      moduleName: r.moduleName,
      actionName: r.actionName,
      isGranted: r.isGranted === 1 || r.isGranted === true,
      reason: r.reason,
      approvedBy: r.approvedBy,
      effectiveFrom: new Date(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
    }));
  }

  /**
   * Retrieves active temporal overrides for a user.
   */
  async findActiveByUserId(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IUserOverrideAssignment[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          upo.UserPermissionOverrideID AS userPermissionOverrideId,
          upo.UserID AS userId,
          upo.PermissionID AS permissionId,
          p.PermissionCode AS permissionCode,
          p.ModuleName AS moduleName,
          p.ActionName AS actionName,
          upo.IsGranted AS isGranted,
          upo.Reason AS reason,
          upo.ApprovedBy AS approvedBy,
          upo.EffectiveFrom AS effectiveFrom,
          upo.EffectiveTo AS effectiveTo
      FROM [auth].[UserPermissionOverrides] upo
      INNER JOIN [auth].[Permissions] p ON p.PermissionID = upo.PermissionID
      WHERE upo.UserID = @0
        AND upo.EffectiveFrom <= SYSUTCDATETIME()
        AND (upo.EffectiveTo IS NULL OR upo.EffectiveTo > SYSUTCDATETIME())
      ORDER BY upo.EffectiveFrom DESC;
      `,
      [userId],
    );

    return rows.map((r: any) => ({
      userPermissionOverrideId: r.userPermissionOverrideId,
      userId: r.userId,
      permissionId: r.permissionId,
      permissionCode: r.permissionCode,
      moduleName: r.moduleName,
      actionName: r.actionName,
      isGranted: r.isGranted === 1 || r.isGranted === true,
      reason: r.reason,
      approvedBy: r.approvedBy,
      effectiveFrom: new Date(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
    }));
  }

  /**
   * Finds a permission override by UserPermissionOverrideID.
   */
  async findById(
    userPermissionOverrideId: string,
    qr?: QueryRunner,
  ): Promise<IUserOverrideAssignment | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          upo.UserPermissionOverrideID AS userPermissionOverrideId,
          upo.UserID AS userId,
          upo.PermissionID AS permissionId,
          p.PermissionCode AS permissionCode,
          p.ModuleName AS moduleName,
          p.ActionName AS actionName,
          upo.IsGranted AS isGranted,
          upo.Reason AS reason,
          upo.ApprovedBy AS approvedBy,
          upo.EffectiveFrom AS effectiveFrom,
          upo.EffectiveTo AS effectiveTo
      FROM [auth].[UserPermissionOverrides] upo
      INNER JOIN [auth].[Permissions] p ON p.PermissionID = upo.PermissionID
      WHERE upo.UserPermissionOverrideID = @0;
      `,
      [userPermissionOverrideId],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      userPermissionOverrideId: r.userPermissionOverrideId,
      userId: r.userId,
      permissionId: r.permissionId,
      permissionCode: r.permissionCode,
      moduleName: r.moduleName,
      actionName: r.actionName,
      isGranted: r.isGranted === 1 || r.isGranted === true,
      reason: r.reason,
      approvedBy: r.approvedBy,
      effectiveFrom: new Date(r.effectiveFrom),
      effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
    };
  }

  /**
   * Creates a new user permission override.
   */
  async createOverride(
    data: IManageOverrideData,
    qr?: QueryRunner,
  ): Promise<string> {
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].[UserPermissionOverrides] (
          UserPermissionOverrideID,
          UserID,
          PermissionID,
          IsGranted,
          Reason,
          ApprovedBy,
          EffectiveFrom,
          EffectiveTo
      )
      OUTPUT INSERTED.UserPermissionOverrideID AS userPermissionOverrideId
      VALUES (
          NEWID(),
          @0,
          @1,
          @2,
          @3,
          @4,
          COALESCE(@5, SYSUTCDATETIME()),
          @6
      );
      `,
      [
        data.userId,
        data.permissionId,
        data.isGranted ? 1 : 0,
        data.reason || null,
        data.approvedBy || null,
        data.effectiveFrom || null,
        data.effectiveTo || null,
      ],
    );

    return rows[0].userPermissionOverrideId;
  }

  /**
   * Revokes an override by setting EffectiveTo = SYSUTCDATETIME().
   */
  async revokeOverride(
    userPermissionOverrideId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[UserPermissionOverrides]
      SET EffectiveTo = SYSUTCDATETIME()
      WHERE UserPermissionOverrideID = @0;
      `,
      [userPermissionOverrideId],
    );
  }

  /**
   * Ends all active overrides for a user.
   */
  async revokeAllForUser(userId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[UserPermissionOverrides]
      SET EffectiveTo = SYSUTCDATETIME()
      WHERE UserID = @0
        AND (EffectiveTo IS NULL OR EffectiveTo > SYSUTCDATETIME());
      `,
      [userId],
    );
  }
}
