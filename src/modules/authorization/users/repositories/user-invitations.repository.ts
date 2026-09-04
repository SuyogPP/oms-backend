import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IUserInvitation } from '../interfaces/users.interface';
import { InvitationPurpose } from '../users.constants';

@Injectable()
export class UserInvitationsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Creates an invitation / reset token entry in auth.UserInvitations.
   */
  async create(
    userId: string,
    tokenHash: string,
    purpose: InvitationPurpose,
    expiresAt: Date,
    createdBy?: string,
    qr?: QueryRunner,
  ): Promise<string> {
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].[UserInvitations] (
          UserInvitationID,
          UserID,
          TokenHash,
          Purpose,
          ExpiresAt,
          IssuedByUserID,
          IssuedToEmail,
          CreatedAt
      )
      OUTPUT INSERTED.UserInvitationID AS invitationId
      SELECT
          NEWID(),
          @0,
          CONVERT(VARBINARY(32), @1, 2),
          @2,
          @3,
          @4,
          COALESCE(u.Email, 'user@domain.com'),
          SYSUTCDATETIME()
      FROM [auth].[Users] u
      WHERE u.UserID = @0;
      `,
      [userId, tokenHash, purpose, expiresAt, createdBy || null],
    );

    return rows[0]?.invitationId || userId;
  }

  /**
   * Finds an invitation by token hash (verifying non-consumed and non-expired).
   */
  async findByTokenHash(
    tokenHash: string,
    qr?: QueryRunner,
  ): Promise<IUserInvitation | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          i.UserInvitationID AS invitationId,
          i.UserID AS userId,
          CONVERT(NVARCHAR(64), i.TokenHash, 2) AS tokenHash,
          i.Purpose AS purpose,
          i.ExpiresAt AS expiresAt,
          i.ConsumedAt AS consumedAt,
          i.CreatedAt AS createdAt,
          i.IssuedByUserID AS createdBy
      FROM [auth].[UserInvitations] i
      WHERE i.TokenHash = CONVERT(VARBINARY(32), @0, 2);
      `,
      [tokenHash],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      invitationId: r.invitationId,
      userId: r.userId,
      tokenHash: r.tokenHash,
      purpose: r.purpose,
      expiresAt: new Date(r.expiresAt),
      consumedAt: r.consumedAt ? new Date(r.consumedAt) : null,
      createdAt: new Date(r.createdAt),
      createdBy: r.createdBy,
    };
  }

  /**
   * Marks an invitation as consumed.
   */
  async markConsumed(invitationId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[UserInvitations]
      SET ConsumedAt = SYSUTCDATETIME()
      WHERE UserInvitationID = @0;
      `,
      [invitationId],
    );
  }

  /**
   * Revokes outstanding tokens for a user by purpose (e.g. when resending invite).
   */
  async revokeOutstanding(
    userId: string,
    purpose: InvitationPurpose,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[UserInvitations]
      SET ConsumedAt = SYSUTCDATETIME(), RevokedAt = SYSUTCDATETIME()
      WHERE UserID = @0
        AND Purpose = @1
        AND ConsumedAt IS NULL
        AND RevokedAt IS NULL;
      `,
      [userId, purpose],
    );
  }

  /**
   * Finds the latest invitation for a user by purpose.
   */
  async findLatestByUserId(
    userId: string,
    purpose: InvitationPurpose,
    qr?: QueryRunner,
  ): Promise<IUserInvitation | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT TOP 1
          i.UserInvitationID AS invitationId,
          i.UserID AS userId,
          CONVERT(NVARCHAR(64), i.TokenHash, 2) AS tokenHash,
          i.Purpose AS purpose,
          i.ExpiresAt AS expiresAt,
          i.ConsumedAt AS consumedAt,
          i.CreatedAt AS createdAt,
          i.IssuedByUserID AS createdBy
      FROM [auth].[UserInvitations] i
      WHERE i.UserID = @0 AND i.Purpose = @1
      ORDER BY i.CreatedAt DESC;
      `,
      [userId, purpose],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      invitationId: r.invitationId,
      userId: r.userId,
      tokenHash: r.tokenHash,
      purpose: r.purpose,
      expiresAt: new Date(r.expiresAt),
      consumedAt: r.consumedAt ? new Date(r.consumedAt) : null,
      createdAt: new Date(r.createdAt),
      createdBy: r.createdBy,
    };
  }

  /**
   * Finds a token by hash joined with user details for validation and acceptance.
   */
  async findByTokenHashWithUser(
    tokenHash: string,
    qr?: QueryRunner,
  ): Promise<{
    invitation: IUserInvitation;
    user: {
      userId: string;
      username: string;
      email: string;
      isActive: boolean;
      isDeleted: boolean;
    };
  } | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          i.UserInvitationID AS invitationId,
          i.UserID AS userId,
          CONVERT(NVARCHAR(64), i.TokenHash, 2) AS tokenHash,
          i.Purpose AS purpose,
          i.ExpiresAt AS expiresAt,
          i.ConsumedAt AS consumedAt,
          i.CreatedAt AS createdAt,
          i.IssuedByUserID AS createdBy,
          u.Username AS username,
          u.Email AS email,
          u.IsActive AS isActive,
          u.IsDeleted AS isDeleted
      FROM [auth].[UserInvitations] i
      INNER JOIN [auth].[Users] u ON u.UserID = i.UserID
      WHERE i.TokenHash = CONVERT(VARBINARY(32), @0, 2);
      `,
      [tokenHash],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      invitation: {
        invitationId: r.invitationId,
        userId: r.userId,
        tokenHash: r.tokenHash,
        purpose: r.purpose,
        expiresAt: new Date(r.expiresAt),
        consumedAt: r.consumedAt ? new Date(r.consumedAt) : null,
        createdAt: new Date(r.createdAt),
        createdBy: r.createdBy,
      },
      user: {
        userId: r.userId,
        username: r.username,
        email: r.email,
        isActive: r.isActive === 1 || r.isActive === true,
        isDeleted: r.isDeleted === 1 || r.isDeleted === true,
      },
    };
  }
}
