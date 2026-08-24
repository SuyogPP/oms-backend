import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IDelegation,
  ICreateDelegationData,
  IUpdateDelegationData,
} from '../interfaces/delegations.interface';

@Injectable()
export class DelegationsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Finds a delegation by ID with delegator and delegate names.
   */
  async findById(
    delegationId: string,
    qr?: QueryRunner,
  ): Promise<IDelegation | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          d.DelegationID AS delegationId,
          d.FromUserID AS fromUserId,
          CONCAT(fp.FirstName, ' ', fp.LastName) AS fromUserName,
          d.ToUserID AS toUserId,
          CONCAT(tp.FirstName, ' ', tp.LastName) AS toUserName,
          d.StartDate AS startDate,
          d.EndDate AS endDate,
          d.Reason AS reason,
          d.IsActive AS isActive,
          d.CreatedAt AS createdAt
      FROM [auth].[Delegations] d
      LEFT JOIN [auth].[UserProfiles] fp ON fp.UserID = d.FromUserID
      LEFT JOIN [auth].[UserProfiles] tp ON tp.UserID = d.ToUserID
      WHERE d.DelegationID = @0;
      `,
      [delegationId],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    const permRows = await this.getExecutor(qr).query(
      `
      SELECT 
          p.PermissionID AS permissionId,
          p.PermissionCode AS permissionCode
      FROM [auth].[DelegationPermissions] dp
      INNER JOIN [auth].[Permissions] p ON p.PermissionID = dp.PermissionID
      WHERE dp.DelegationID = @0;
      `,
      [delegationId],
    ).catch(() => []);

    return {
      delegationId: r.delegationId,
      fromUserId: r.fromUserId,
      fromUserName: r.fromUserName ? r.fromUserName.trim() : undefined,
      toUserId: r.toUserId,
      toUserName: r.toUserName ? r.toUserName.trim() : undefined,
      startDate: new Date(r.startDate),
      endDate: new Date(r.endDate),
      reason: r.reason,
      isActive: r.isActive === 1 || r.isActive === true,
      permissionIds: permRows.map((p: any) => p.permissionId),
      permissionCodes: permRows.map((p: any) => p.permissionCode),
      createdAt: new Date(r.createdAt),
    };
  }

  /**
   * Retrieves all delegations received by a user (ToUserID = userId).
   */
  async findByToUserId(
    toUserId: string,
    qr?: QueryRunner,
  ): Promise<IDelegation[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          d.DelegationID AS delegationId,
          d.FromUserID AS fromUserId,
          CONCAT(fp.FirstName, ' ', fp.LastName) AS fromUserName,
          d.ToUserID AS toUserId,
          CONCAT(tp.FirstName, ' ', tp.LastName) AS toUserName,
          d.StartDate AS startDate,
          d.EndDate AS endDate,
          d.Reason AS reason,
          d.IsActive AS isActive,
          d.CreatedAt AS createdAt
      FROM [auth].[Delegations] d
      LEFT JOIN [auth].[UserProfiles] fp ON fp.UserID = d.FromUserID
      LEFT JOIN [auth].[UserProfiles] tp ON tp.UserID = d.ToUserID
      WHERE d.ToUserID = @0
      ORDER BY d.StartDate DESC;
      `,
      [toUserId],
    );

    return rows.map((r: any) => ({
      delegationId: r.delegationId,
      fromUserId: r.fromUserId,
      fromUserName: r.fromUserName ? r.fromUserName.trim() : undefined,
      toUserId: r.toUserId,
      toUserName: r.toUserName ? r.toUserName.trim() : undefined,
      startDate: new Date(r.startDate),
      endDate: new Date(r.endDate),
      reason: r.reason,
      isActive: r.isActive === 1 || r.isActive === true,
      createdAt: new Date(r.createdAt),
    }));
  }

  /**
   * Retrieves all delegations granted by a user (FromUserID = userId).
   */
  async findByFromUserId(
    fromUserId: string,
    qr?: QueryRunner,
  ): Promise<IDelegation[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          d.DelegationID AS delegationId,
          d.FromUserID AS fromUserId,
          CONCAT(fp.FirstName, ' ', fp.LastName) AS fromUserName,
          d.ToUserID AS toUserId,
          CONCAT(tp.FirstName, ' ', tp.LastName) AS toUserName,
          d.StartDate AS startDate,
          d.EndDate AS endDate,
          d.Reason AS reason,
          d.IsActive AS isActive,
          d.CreatedAt AS createdAt
      FROM [auth].[Delegations] d
      LEFT JOIN [auth].[UserProfiles] fp ON fp.UserID = d.FromUserID
      LEFT JOIN [auth].[UserProfiles] tp ON tp.UserID = d.ToUserID
      WHERE d.FromUserID = @0
      ORDER BY d.StartDate DESC;
      `,
      [fromUserId],
    );

    return rows.map((r: any) => ({
      delegationId: r.delegationId,
      fromUserId: r.fromUserId,
      fromUserName: r.fromUserName ? r.fromUserName.trim() : undefined,
      toUserId: r.toUserId,
      toUserName: r.toUserName ? r.toUserName.trim() : undefined,
      startDate: new Date(r.startDate),
      endDate: new Date(r.endDate),
      reason: r.reason,
      isActive: r.isActive === 1 || r.isActive === true,
      createdAt: new Date(r.createdAt),
    }));
  }

  /**
   * Creates a new delegation and optional scoped permissions.
   */
  async create(
    data: ICreateDelegationData,
    qr?: QueryRunner,
  ): Promise<string> {
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].[Delegations] (
          DelegationID,
          FromUserID,
          ToUserID,
          StartDate,
          EndDate,
          Reason,
          IsActive,
          CreatedAt
      )
      OUTPUT INSERTED.DelegationID AS delegationId
      VALUES (
          NEWID(),
          @0,
          @1,
          @2,
          @3,
          @4,
          1,
          SYSUTCDATETIME()
      );
      `,
      [
        data.fromUserId,
        data.toUserId,
        data.startDate,
        data.endDate,
        data.reason,
      ],
    );

    const delegationId = rows[0].delegationId;

    if (data.permissionIds && data.permissionIds.length > 0) {
      for (const permId of data.permissionIds) {
        await this.getExecutor(qr).query(
          `
          INSERT INTO [auth].[DelegationPermissions] (
              DelegationPermissionID,
              DelegationID,
              PermissionID,
              CreatedAt
          )
          VALUES (
              NEWID(),
              @0,
              @1,
              SYSUTCDATETIME()
          );
          `,
          [delegationId, permId],
        ).catch(() => {});
      }
    }

    return delegationId;
  }

  /**
   * Updates an existing delegation.
   */
  async update(
    delegationId: string,
    data: IUpdateDelegationData,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Delegations]
      SET 
          EndDate = COALESCE(@1, EndDate),
          Reason = COALESCE(@2, Reason),
          IsActive = CASE WHEN @3 IS NOT NULL THEN @3 ELSE IsActive END
      WHERE DelegationID = @0;
      `,
      [
        delegationId,
        data.endDate || null,
        data.reason || null,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : null,
      ],
    );
  }

  /**
   * Cancels/deactivates a delegation immediately.
   */
  async cancel(delegationId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Delegations]
      SET IsActive = 0, EndDate = SYSUTCDATETIME()
      WHERE DelegationID = @0;
      `,
      [delegationId],
    );
  }

  /**
   * Ends all active delegations for a user (as fromUser or toUser).
   */
  async endAllForUser(userId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Delegations]
      SET IsActive = 0, EndDate = SYSUTCDATETIME()
      WHERE (FromUserID = @0 OR ToUserID = @0)
        AND IsActive = 1
        AND EndDate > SYSUTCDATETIME();
      `,
      [userId],
    );
  }

  /**
   * Checks whether the user has an active overlapping delegation (D3 rule).
   */
  async hasActiveOverlappingDelegation(
    fromUserId: string,
    startDate: Date,
    endDate: Date,
    excludeDelegationId?: string,
    qr?: QueryRunner,
  ): Promise<boolean> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP 1 1 AS hasOverlap
      FROM [auth].[Delegations] d
      WHERE d.FromUserID = @0
        AND d.IsActive = 1
        AND (@3 IS NULL OR d.DelegationID != @3)
        AND (d.StartDate <= @2 AND d.EndDate >= @1);
      `,
      [fromUserId, startDate, endDate, excludeDelegationId || null],
    );

    return rows && rows.length > 0;
  }

  /**
   * Checks if user is currently acting as a delegate under another active delegation (D5 chained guard).
   */
  async isCurrentlyActingDelegate(
    userId: string,
    qr?: QueryRunner,
  ): Promise<boolean> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP 1 1 AS isDelegate
      FROM [auth].[Delegations] d
      WHERE d.ToUserID = @0
        AND d.IsActive = 1
        AND d.StartDate <= SYSUTCDATETIME()
        AND d.EndDate > SYSUTCDATETIME();
      `,
      [userId],
    );

    return rows && rows.length > 0;
  }
}
