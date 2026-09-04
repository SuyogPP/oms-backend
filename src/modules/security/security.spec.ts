import { Test, TestingModule } from '@nestjs/testing';
import { SecurityDashboardService } from './services/security-dashboard.service';
import { SecurityChartsService } from './services/security-charts.service';
import { SecurityRepository } from './repositories/security.repository';
import { SecurityDashboardController } from './controllers/security-dashboard.controller';
import { SecurityChartsController } from './controllers/security-charts.controller';
import { BaseQueryDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { AuthorizationService } from '../auth/services/authorization.service';
import { Reflector } from '@nestjs/core';

describe('SecurityModule (Step 1)', () => {
  let dashboardService: SecurityDashboardService;
  let chartsService: SecurityChartsService;
  let mockSecurityRepository: Partial<SecurityRepository>;

  beforeEach(async () => {
    mockSecurityRepository = {
      getDashboardSummary: jest.fn().mockResolvedValue({
        activeSessions: 5,
        lockedUsers: 1,
        failedLogins24Hours: 3,
        successfulLogins24Hours: 15,
        securityEvents24Hours: 20,
        rateLimitEvents24Hours: 2,
        activeUsersToday: 8,
        revokedSessions24Hours: 1,
        refreshTokenReplayEvents24Hours: 0,
      }),
      getSecuritySummaryById: jest.fn().mockResolvedValue({
        activeSessions: 1,
        failedLoginsLast30Days: 0,
        successfulLoginsLast30Days: 10,
        securityEventsLast30Days: 12,
        lastLoginAt: '2026-08-20T10:00:00.000Z',
        lastLogoutAt: null,
        accountLocked: false,
        lockedUntil: null,
      }),
      getSecurityEvents: jest.fn().mockResolvedValue(
        new PaginatedResult(
          [
            {
              securityEventId: 1,
              userId: 'usr-1',
              loginSessionId: 'sess-1',
              eventType: 'LOGIN_SUCCESS',
              eventDescription: null,
              ipAddress: '127.0.0.1',
              userAgent: 'Jest',
              createdAt: '2026-08-20T10:00:00.000Z',
            },
          ],
          1,
          1,
          10,
        ),
      ),
      getFailedLoginAttempts: jest.fn().mockResolvedValue(
        new PaginatedResult(
          [
            {
              failedLoginAttemptId: 1,
              userId: 'usr-1',
              username: 'john.doe',
              ipAddress: '127.0.0.1',
              failureReason: 'Invalid credentials',
              attemptedAt: '2026-08-20T09:00:00.000Z',
              browserName: 'Chrome',
              deviceType: 'Desktop',
            },
          ],
          1,
          1,
          10,
        ),
      ),
      getActiveSessionsDashboard: jest.fn().mockResolvedValue([
        {
          loginSessionId: 'sess-1',
          userId: 'usr-1',
          username: 'john.doe',
          ipAddress: '127.0.0.1',
          deviceInfo: 'Desktop',
          browserName: 'Chrome',
          deviceType: 'Desktop',
          lastActivityAt: '2026-08-20T10:00:00.000Z',
          loginAt: '2026-08-20T08:00:00.000Z',
          expiresAt: '2026-08-20T16:00:00.000Z',
        },
      ]),
      failedLoginChartData: jest.fn().mockResolvedValue([
        { date: '2026-08-19', count: 2 },
        { date: '2026-08-20', count: 1 },
      ]),
      securityEventsByTypeChartData: jest.fn().mockResolvedValue([
        { eventType: 'LOGIN_SUCCESS', count: 15 },
        { eventType: 'LOGIN_FAILURE', count: 3 },
      ]),
      sessionsByDeviceChartData: jest.fn().mockResolvedValue([
        { device: 'Desktop', count: 4 },
        { device: 'Mobile', count: 1 },
      ]),
      sessionsByRoleChartData: jest.fn().mockResolvedValue([
        { role: 'SYSTEM_ADMIN', count: 2 },
        { role: 'HR', count: 3 },
      ]),
      loginTrendChartData: jest
        .fn()
        .mockResolvedValue([{ date: '2026-08-20', success: 15, failure: 3 }]),
      replayEventsChartData: jest.fn().mockResolvedValue([]),
      lockedAccountsChartData: jest
        .fn()
        .mockResolvedValue([{ username: 'locked.user', lockouts: 5 }]),
      sessionsCreatedPerDayChartData: jest
        .fn()
        .mockResolvedValue([{ date: '2026-08-20', count: 5 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityDashboardController, SecurityChartsController],
      providers: [
        SecurityDashboardService,
        SecurityChartsService,
        AuthorizationService,
        Reflector,
        {
          provide: SecurityRepository,
          useValue: mockSecurityRepository,
        },
      ],
    }).compile();

    dashboardService = module.get<SecurityDashboardService>(
      SecurityDashboardService,
    );
    chartsService = module.get<SecurityChartsService>(SecurityChartsService);
  });

  describe('SecurityDashboardService', () => {
    it('should get composite dashboard data', async () => {
      const data = await dashboardService.getDashboardData();
      expect(data.summary.activeSessions).toBe(5);
      expect(data.events).toHaveLength(1);
      expect(data.failedLogins).toHaveLength(1);
      expect(data.activeSessions).toHaveLength(1);
    });

    it('should get 24-hour summary', async () => {
      const summary = await dashboardService.getSummary();
      expect(summary.lockedUsers).toBe(1);
      expect(summary.activeUsersToday).toBe(8);
    });

    it('should get user summary by ID', async () => {
      const summary = await dashboardService.getUserSummary('usr-1');
      expect(summary.successfulLoginsLast30Days).toBe(10);
      expect(summary.accountLocked).toBe(false);
    });

    it('should get paginated security events', async () => {
      const result = await dashboardService.getSecurityEvents(
        new BaseQueryDto(),
      );
      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('SecurityChartsService', () => {
    it('should get chart data for all 7 endpoints', async () => {
      const failedLogins = await chartsService.getFailedLogins();
      const eventsByType = await chartsService.getSecurityEventsByType();
      const sessionsByDevice = await chartsService.getSessionsByDevice();
      const sessionsByRole = await chartsService.getSessionsByRole();
      const loginTrend = await chartsService.getLoginTrend();
      const replayEvents = await chartsService.getReplayEvents();
      const lockedAccounts = await chartsService.getLockedAccounts();

      expect(failedLogins).toHaveLength(2);
      expect(eventsByType).toHaveLength(2);
      expect(sessionsByDevice).toHaveLength(2);
      expect(sessionsByRole).toHaveLength(2);
      expect(loginTrend).toHaveLength(1);
      expect(replayEvents).toEqual([]);
      expect(lockedAccounts).toHaveLength(1);
    });
  });
});
