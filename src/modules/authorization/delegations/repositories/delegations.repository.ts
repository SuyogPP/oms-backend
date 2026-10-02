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
          d.delegation_id AS delegationId,
          d.from_user_id AS fromUserId,
          CONCAT(fp.first_name, ' ', fp.last_name) AS fromUserName,
          d.to_user_id AS toUserId,
          CONCAT(tp.first_name, ' ', tp.last_name) AS toUserName,
          d.start_date AS startDate,
          d.end_date AS endDate,
          d.Reason AS reason,
          d.is_active AS isActive,
          d.start_date AS createdAt
      FROM [auth].tbl_Delegations] d
      LEFT JOIN [auth].[UserProfiles] fp ON fp.user_id = d.from_user_id
      LEFT JOIN [auth].[UserProfiles] tp ON tp.user_id = d.to_user_id
      WHERE d.delegation_id = @0;
      `,
      [delegationId],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    const permRows = await this.getExecutor(qr)
      .query(
        `
      SELECT 
          p.permission_id AS permissionId,
          p.permission_code AS permissionCode
      FROM [auth].tbl_Delegation_Permissions] dp
      INNER JOIN [auth].tbl_Permissions] p ON p.permission_id = dp.permission_id
      WHERE dp.delegation_id = @0;
      `,
        [delegationId],
      )
      .catch(() => []);

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
          d.delegation_id AS delegationId,
          d.from_user_id AS fromUserId,
          CONCAT(fp.first_name, ' ', fp.last_name) AS fromUserName,
          d.to_user_id AS toUserId,
          CONCAT(tp.first_name, ' ', tp.last_name) AS toUserName,
          d.start_date AS startDate,
          d.end_date AS endDate,
          d.Reason AS reason,
          d.is_active AS isActive,
          d.start_date AS createdAt
      FROM [auth].tbl_Delegations] d
      LEFT JOIN [auth].[UserProfiles] fp ON fp.user_id = d.from_user_id
      LEFT JOIN [auth].[UserProfiles] tp ON tp.user_id = d.to_user_id
      WHERE d.to_user_id = @0
      ORDER BY d.start_date DESC;
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
          d.delegation_id AS delegationId,
          d.from_user_id AS fromUserId,
          CONCAT(fp.first_name, ' ', fp.last_name) AS fromUserName,
          d.to_user_id AS toUserId,
          CONCAT(tp.first_name, ' ', tp.last_name) AS toUserName,
          d.start_date AS startDate,
          d.end_date AS endDate,
          d.Reason AS reason,
          d.is_active AS isActive,
          d.start_date AS createdAt
      FROM [auth].tbl_Delegations] d
      LEFT JOIN [auth].[UserProfiles] fp ON fp.user_id = d.from_user_id
      LEFT JOIN [auth].[UserProfiles] tp ON tp.user_id = d.to_user_id
      WHERE d.from_user_id = @0
      ORDER BY d.start_date DESC;
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
  async create(data: ICreateDelegationData, qr?: QueryRunner): Promise<string> {
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].tbl_Delegations] (
          DelegationID,
          FromUserID,
          ToUserID,
          StartDate,
          EndDate,
          Reason,
          IsActive
      )
      OUTPUT INSERTED.delegation_id AS delegationId
      VALUES (
          NEWID(),
          @0,
          @1,
          @2,
          @3,
          @4,
          1
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
        await this.getExecutor(qr)
          .query(
            `
          INSERT INTO [auth].tbl_Delegation_Permissions] (
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
          )
          .catch(() => {});
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
      UPDATE [auth].tbl_Delegations]
      SET 
          EndDate = COALESCE(@1, EndDate),
          Reason = COALESCE(@2, Reason),
          IsActive = CASE WHEN @3 IS NOT NULL THEN @3 ELSE IsActive END
      WHERE delegation_id = @0;
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
      UPDATE [auth].tbl_Delegations]
      SET is_active = 0, EndDate = SYSUTCDATETIME()
      WHERE delegation_id = @0;
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
      UPDATE [auth].tbl_Delegations]
      SET is_active = 0, EndDate = SYSUTCDATETIME()
      WHERE (FromUserID = @0 OR to_user_id = @0)
        AND is_active = 1
        AND end_date > SYSUTCDATETIME();
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
      FROM [auth].tbl_Delegations] d
      WHERE d.from_user_id = @0
        AND d.is_active = 1
        AND (@3 IS NULL OR d.delegation_id != @3)
        AND (d.start_date <= @2 AND d.end_date >= @1);
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
      FROM [auth].tbl_Delegations] d
      WHERE d.to_user_id = @0
        AND d.is_active = 1
        AND d.start_date <= SYSUTCDATETIME()
        AND d.end_date > SYSUTCDATETIME();
      `,
      [userId],
    );

    return rows && rows.length > 0;
  }
}
