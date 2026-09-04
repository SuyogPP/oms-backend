import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RequestContextService } from '../../common/services/request-context.service';
import { AuthorizationService } from '../auth/services/authorization.service';
import { SecurityEventsService } from '../security-events/services/security-events.service';
import { SecuritySettingsService } from '../security/services/security-settings.service';
import { RetentionController } from './controllers/retention.controller';
import { RetentionRepository } from './repositories/retention.repository';
import { RetentionService } from './services/retention.service';

describe('RetentionModule (Step 5)', () => {
  let service: RetentionService;
  let mockRepository: Partial<RetentionRepository>;
  let mockSecuritySettingsService: Partial<SecuritySettingsService>;
  let mockSecurityEventsService: Partial<SecurityEventsService>;

  beforeEach(async () => {
    mockRepository = {
      purgeSecurityEvents: jest.fn().mockResolvedValue(12),
      purgeLoginHistory: jest.fn().mockResolvedValue(25),
      purgeLogoutHistory: jest.fn().mockResolvedValue(8),
      purgeFailedLogins: jest.fn().mockResolvedValue(4),
      purgeInactiveSessions: jest.fn().mockResolvedValue(6),
    };

    mockSecuritySettingsService = {
      getSettings: jest.fn().mockResolvedValue({
        securityEventsRetention: 365,
        loginHistoryRetention: 365,
        logoutHistoryRetention: 365,
        failedLoginRetention: 180,
      } as any),
    };

    mockSecurityEventsService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RetentionController],
      providers: [
        RetentionService,
        RequestContextService,
        Reflector,
        {
          provide: AuthorizationService,
          useValue: { hasPermission: jest.fn().mockReturnValue(true) },
        },
        { provide: RetentionRepository, useValue: mockRepository },
        {
          provide: SecuritySettingsService,
          useValue: mockSecuritySettingsService,
        },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
  });

  describe('executeCleanup', () => {
    it('should load retention settings, purge expired records across all tables, and log security event', async () => {
      const result = await service.executeCleanup('MANUAL_TEST');

      expect(result.success).toBe(true);
      expect(result.metrics.securityEventsDeleted).toBe(12);
      expect(result.metrics.loginHistoryDeleted).toBe(25);
      expect(result.metrics.logoutHistoryDeleted).toBe(8);
      expect(result.metrics.failedLoginsDeleted).toBe(4);
      expect(result.metrics.loginSessionsDeleted).toBe(6);
      expect(result.metrics.totalDeleted).toBe(55);

      expect(mockRepository.purgeSecurityEvents).toHaveBeenCalledWith(365);
      expect(mockRepository.purgeLoginHistory).toHaveBeenCalledWith(365);
      expect(mockRepository.purgeLogoutHistory).toHaveBeenCalledWith(365);
      expect(mockRepository.purgeFailedLogins).toHaveBeenCalledWith(180);
      expect(mockRepository.purgeInactiveSessions).toHaveBeenCalledWith(365);

      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'RETENTION_JOB_EXECUTED',
        expect.objectContaining({
          description: expect.stringContaining('Total: 55'),
        }),
      );
    });
  });

  describe('handleCron', () => {
    it('should execute automated cron job without errors', async () => {
      await expect(service.handleCron()).resolves.not.toThrow();
      expect(mockRepository.purgeSecurityEvents).toHaveBeenCalled();
    });
  });
});
