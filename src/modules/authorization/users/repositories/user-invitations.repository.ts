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
   * Creates an invitation / reset token entry in auth.tbl_User_Invitations.
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
      INSERT INTO [auth].[tbl_User_Invitations] (
          UserInvitationID,
          UserID,
          TokenHash,
          Purpose,
          ExpiresAt,
          IssuedByUserID,
          IssuedToEmail,
          CreatedAt
      )
      OUTPUT INSERTED.user_invitation_id AS invitationId
      SELECT
          NEWID(),
          @0,
          CONVERT(VARBINARY(32), @1, 2),
          @2,
          @3,
          @4,
          COALESCE(u.Email, 'user@domain.com'),
          SYSUTCDATETIME()
      FROM [auth].[tbl_Users] u
      WHERE u.user_id = @0;
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
          i.user_invitation_id AS invitationId,
          i.user_id AS userId,
          CONVERT(NVARCHAR(64), i.token_hash, 2) AS tokenHash,
          i.Purpose AS purpose,
          i.expires_at AS expiresAt,
          i.consumed_at AS consumedAt,
          i.created_at AS createdAt,
          i.issued_by_user_id AS createdBy
      FROM [auth].[tbl_User_Invitations] i
      WHERE i.token_hash = CONVERT(VARBINARY(32), @0, 2);
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
      UPDATE [auth].[tbl_User_Invitations]
      SET consumed_at = SYSUTCDATETIME()
      WHERE user_invitation_id = @0;
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
      UPDATE [auth].[tbl_User_Invitations]
      SET consumed_at = SYSUTCDATETIME(), RevokedAt = SYSUTCDATETIME()
      WHERE user_id = @0
        AND Purpose = @1
        AND consumed_at IS NULL
        AND revoked_at IS NULL;
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
          i.user_invitation_id AS invitationId,
          i.user_id AS userId,
          CONVERT(NVARCHAR(64), i.token_hash, 2) AS tokenHash,
          i.Purpose AS purpose,
          i.expires_at AS expiresAt,
          i.consumed_at AS consumedAt,
          i.created_at AS createdAt,
          i.issued_by_user_id AS createdBy
      FROM [auth].[tbl_User_Invitations] i
      WHERE i.user_id = @0 AND i.Purpose = @1
      ORDER BY i.created_at DESC;
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
          i.user_invitation_id AS invitationId,
          i.user_id AS userId,
          CONVERT(NVARCHAR(64), i.token_hash, 2) AS tokenHash,
          i.Purpose AS purpose,
          i.expires_at AS expiresAt,
          i.consumed_at AS consumedAt,
          i.created_at AS createdAt,
          i.issued_by_user_id AS createdBy,
          u.Username AS username,
          u.Email AS email,
          u.is_active AS isActive,
          u.IsDeleted AS isDeleted
      FROM [auth].[tbl_User_Invitations] i
      INNER JOIN [auth].[tbl_Users] u ON u.user_id = i.user_id
      WHERE i.token_hash = CONVERT(VARBINARY(32), @0, 2);
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
