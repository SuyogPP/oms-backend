import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import { CandidateTokensService } from './candidate-tokens.service';
import { CandidateTokensRepository } from '../repositories/candidate-tokens.repository';
import {
  CANDIDATE_TOKEN_ERROR_CODES,
  GENERIC_INVALID_CANDIDATE_TOKEN_MESSAGE,
} from '../candidate-tokens.constants';

describe('CandidateTokensService', () => {
  let service: CandidateTokensService;
  let repository: jest.Mocked<CandidateTokensRepository>;
  let dataSource: any;
  let mockQueryRunner: any;

  const mockOnboardingId = 'A78229F7-70CE-4011-8C15-EC8E0234B364';

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const mockRepository = {
      create: jest.fn().mockResolvedValue('token-id-123'),
      findByTokenHash: jest.fn(),
      incrementConsumedCount: jest.fn().mockResolvedValue(undefined),
      revokeOutstanding: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateTokensService,
        {
          provide: CandidateTokensRepository,
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<CandidateTokensService>(CandidateTokensService);
    repository = module.get(CandidateTokensRepository);
  });

  describe('issueToken', () => {
    it('should generate a 32-byte base64url token and store its SHA-256 hash', async () => {
      const result = await service.issueToken(mockOnboardingId);

      expect(result.success).toBe(true);
      expect(result.onboardingId).toBe(mockOnboardingId);
      expect(result.rawToken).toBeDefined();
      // 32 bytes in base64url is 43 characters
      expect(result.rawToken.length).toBe(43);

      const expectedHash = crypto
        .createHash('sha256')
        .update(result.rawToken)
        .digest('hex');

      expect(repository.revokeOutstanding).toHaveBeenCalledWith(
        mockOnboardingId,
        mockQueryRunner,
      );
      expect(repository.create).toHaveBeenCalledWith(
        mockOnboardingId,
        expectedHash,
        expect.any(Date),
        mockQueryRunner,
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should default expiration to 14 days', async () => {
      const before = Date.now();
      const result = await service.issueToken(mockOnboardingId);
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + fourteenDaysMs - 1000);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + fourteenDaysMs + 1000);
    });

    it('should throw BadRequestException if onboardingId is missing', async () => {
      await expect(service.issueToken('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateToken', () => {
    it('should throw generic non-enumeration error if token is empty', async () => {
      try {
        await service.validateToken('');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toEqual({
          code: CANDIDATE_TOKEN_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED,
          message: GENERIC_INVALID_CANDIDATE_TOKEN_MESSAGE,
        });
      }
    });

    it('should throw generic non-enumeration error if token is unknown', async () => {
      repository.findByTokenHash.mockResolvedValue(null);

      try {
        await service.validateToken('unknown-token-12345678901234567890');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toEqual({
          code: CANDIDATE_TOKEN_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED,
          message: GENERIC_INVALID_CANDIDATE_TOKEN_MESSAGE,
        });
      }
    });

    it('should throw generic non-enumeration error if token is revoked', async () => {
      repository.findByTokenHash.mockResolvedValue({
        tokenId: 'tok-1',
        onboardingId: mockOnboardingId,
        tokenHash: 'abc',
        expiresAt: new Date(Date.now() + 100000),
        consumedCount: 2,
        revokedAt: new Date(Date.now() - 5000),
        createdAt: new Date(Date.now() - 10000),
      });

      try {
        await service.validateToken('revoked-token-12345678901234567890');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toEqual({
          code: CANDIDATE_TOKEN_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED,
          message: GENERIC_INVALID_CANDIDATE_TOKEN_MESSAGE,
        });
      }
    });

    it('should throw generic non-enumeration error if token is expired', async () => {
      repository.findByTokenHash.mockResolvedValue({
        tokenId: 'tok-1',
        onboardingId: mockOnboardingId,
        tokenHash: 'abc',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        consumedCount: 0,
        revokedAt: null,
        createdAt: new Date(Date.now() - 1000000),
      });

      try {
        await service.validateToken('expired-token-12345678901234567890');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse()).toEqual({
          code: CANDIDATE_TOKEN_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED,
          message: GENERIC_INVALID_CANDIDATE_TOKEN_MESSAGE,
        });
      }
    });

    it('should validate active token and increment consumedCount', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      repository.findByTokenHash.mockResolvedValue({
        tokenId: 'tok-active-1',
        onboardingId: mockOnboardingId,
        tokenHash: 'active-hash',
        expiresAt,
        consumedCount: 3,
        revokedAt: null,
        createdAt: new Date(Date.now() - 10000),
      });

      const result = await service.validateToken('valid-token-12345678901234567890');

      expect(result.valid).toBe(true);
      expect(result.onboardingId).toBe(mockOnboardingId);
      expect(result.expiresAt).toEqual(expiresAt);
      expect(result.consumedCount).toBe(4);
      expect(repository.incrementConsumedCount).toHaveBeenCalledWith('tok-active-1');
    });
  });
});
