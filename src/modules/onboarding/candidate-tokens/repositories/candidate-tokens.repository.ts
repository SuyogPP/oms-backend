import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ICandidateAccessToken } from '../interfaces/candidate-tokens.interface';

@Injectable()
export class CandidateTokensRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Creates an entry in onboarding.CandidateAccessTokens.
   * Stores TokenHash as VARBINARY(32), converting from 64-char hex string.
   */
  async create(
    onboardingId: string,
    tokenHashHex: string,
    expiresAt: Date,
    qr?: QueryRunner,
  ): Promise<string> {
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [onboarding].[CandidateAccessTokens] (
          TokenId,
          OnboardingId,
          TokenHash,
          ExpiresAt,
          ConsumedCount,
          RevokedAt,
          CreatedAt
      )
      OUTPUT INSERTED.TokenId AS tokenId
      VALUES (
          NEWID(),
          @0,
          CONVERT(VARBINARY(32), @1, 2),
          @2,
          0,
          NULL,
          SYSUTCDATETIME()
      );
      `,
      [onboardingId, tokenHashHex, expiresAt],
    );

    return rows[0]?.tokenId;
  }

  /**
   * Finds a token entry by its SHA-256 hash (hex string).
   */
  async findByTokenHash(
    tokenHashHex: string,
    qr?: QueryRunner,
  ): Promise<ICandidateAccessToken | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          t.TokenId AS tokenId,
          t.OnboardingId AS onboardingId,
          CONVERT(NVARCHAR(64), t.token_hash, 2) AS tokenHash,
          t.expires_at AS expiresAt,
          t.ConsumedCount AS consumedCount,
          t.revoked_at AS revokedAt,
          t.created_at AS createdAt
      FROM [onboarding].[CandidateAccessTokens] t
      WHERE t.token_hash = CONVERT(VARBINARY(32), @0, 2);
      `,
      [tokenHashHex],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      tokenId: r.tokenId,
      onboardingId: r.onboardingId,
      tokenHash: r.tokenHash,
      expiresAt: new Date(r.expiresAt),
      consumedCount: Number(r.consumedCount),
      revokedAt: r.revokedAt ? new Date(r.revokedAt) : null,
      createdAt: new Date(r.createdAt),
    };
  }

  /**
   * Increments the multi-use consumption counter.
   */
  async incrementConsumedCount(tokenId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [onboarding].[CandidateAccessTokens]
      SET ConsumedCount = ConsumedCount + 1
      WHERE TokenId = @0;
      `,
      [tokenId],
    );
  }

  /**
   * Revokes outstanding unexpired tokens for an onboarding case.
   */
  async revokeOutstanding(onboardingId: string, qr?: QueryRunner): Promise<number> {
    const result = await this.getExecutor(qr).query(
      `
      UPDATE [onboarding].[CandidateAccessTokens]
      SET revoked_at = SYSUTCDATETIME()
      WHERE OnboardingId = @0 AND revoked_at IS NULL;
      `,
      [onboardingId],
    );

    return result?.[1] || 0;
  }
}
