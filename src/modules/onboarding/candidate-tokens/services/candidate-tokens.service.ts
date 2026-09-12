import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import { CandidateTokensRepository } from '../repositories/candidate-tokens.repository';
import {
  CANDIDATE_TOKEN_EXPIRY_DAYS,
  CANDIDATE_TOKEN_ERROR_CODES,
  GENERIC_INVALID_CANDIDATE_TOKEN_MESSAGE,
} from '../candidate-tokens.constants';
import {
  CandidateTokenValidationResponseDto,
  IssueCandidateTokenResponseDto,
} from '../dto/candidate-token.dto';

@Injectable()
export class CandidateTokensService {
  private readonly logger = new Logger(CandidateTokensService.name);

  constructor(
    private readonly repository: CandidateTokensRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generates and issues a cryptographically secure 32-byte candidate access token.
   * The raw token is returned once for delivery (email) and NEVER persisted in the database.
   * Only the SHA-256 hash is stored.
   */
  async issueToken(
    onboardingId: string,
    expiryDays: number = CANDIDATE_TOKEN_EXPIRY_DAYS,
    revokeExisting: boolean = true,
  ): Promise<IssueCandidateTokenResponseDto> {
    if (!onboardingId) {
      throw new BadRequestException('Onboarding ID is required.');
    }

    // 1. Generate 32 bytes cryptographically secure token in base64url format
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const effectiveDays = expiryDays > 0 ? expiryDays : CANDIDATE_TOKEN_EXPIRY_DAYS;
    const expiresAt = new Date(Date.now() + effectiveDays * 24 * 60 * 60 * 1000);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (revokeExisting) {
        await this.repository.revokeOutstanding(onboardingId, queryRunner);
      }

      await this.repository.create(
        onboardingId,
        tokenHash,
        expiresAt,
        queryRunner,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    this.logger.log(
      `Issued candidate access token for onboarding case [${onboardingId}], expires at [${expiresAt.toISOString()}]`,
    );

    return {
      success: true,
      message: 'Candidate access token issued successfully.',
      rawToken,
      onboardingId,
      expiresAt,
    };
  }

  /**
   * Validates a candidate access token.
   * Constant-time safe against enumeration: expired, revoked, or unknown tokens
   * return the EXACT same error message and code.
   */
  async validateToken(rawToken: string): Promise<CandidateTokenValidationResponseDto> {
    if (!rawToken || rawToken.trim() === '') {
      throw new BadRequestException({
        code: CANDIDATE_TOKEN_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED,
        message: GENERIC_INVALID_CANDIDATE_TOKEN_MESSAGE,
      });
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken.trim())
      .digest('hex');

    const record = await this.repository.findByTokenHash(tokenHash);

    // Constant-time non-enumeration discipline:
    // Non-existent, revoked, or expired token all return the identical message
    if (
      !record ||
      record.revokedAt !== null ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException({
        code: CANDIDATE_TOKEN_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED,
        message: GENERIC_INVALID_CANDIDATE_TOKEN_MESSAGE,
      });
    }

    // Multi-use token within validity window: track usage count
    await this.repository.incrementConsumedCount(record.tokenId);

    return {
      valid: true,
      onboardingId: record.onboardingId,
      expiresAt: record.expiresAt,
      consumedCount: record.consumedCount + 1,
    };
  }

  /**
   * Revokes all outstanding tokens for an onboarding case.
   */
  async revokeTokensForOnboarding(
    onboardingId: string,
  ): Promise<{ success: boolean; revokedCount: number }> {
    const revokedCount = await this.repository.revokeOutstanding(onboardingId);
    return {
      success: true,
      revokedCount,
    };
  }
}
