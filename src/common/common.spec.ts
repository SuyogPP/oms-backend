import { HttpStatus, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { GlobalHttpExceptionFilter } from './filters/http-exception.filter';
import {
  RequestContextService,
  RequestContextStore,
} from './services/request-context.service';
import {
  PaginationQueryDto,
  PaginatedResult,
  sanitizeSortColumn,
} from './dto/pagination.dto';
import { parseFilterQuery, FilterOperator } from './dto/filtering.dto';
import { buildWhereClause } from './utils/filter-query-builder.util';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { SecurityEventsService } from '../modules/security-events/services/security-events.service';

describe('Step 0 Cross-Cutting Foundation', () => {
  let requestContextService: RequestContextService;
  let reflector: Reflector;

  beforeEach(() => {
    requestContextService = new RequestContextService();
    reflector = new Reflector();
  });

  describe('RequestContextService', () => {
    it('should propagate correlationId, user, and IP within context', (done) => {
      const store: RequestContextStore = {
        correlationId: 'test-corr-123',
        startTime: Date.now() - 50,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 JestTest',
        path: '/api/v1/test',
        method: 'GET',
        user: {
          userId: 'usr-456',
          email: 'test@diez.ae',
          userType: 'INTERNAL',
          roles: ['SYSTEM_ADMIN'],
          permissions: ['USER.MANAGE'],
          scopes: ['internal'],
          loginSessionId: 'sess-123',
        },
      };

      RequestContextService.run(store, () => {
        expect(requestContextService.getCorrelationId()).toBe('test-corr-123');
        expect(requestContextService.getUserId()).toBe('usr-456');
        expect(requestContextService.getIpAddress()).toBe('192.168.1.1');
        expect(requestContextService.getUserAgent()).toBe(
          'Mozilla/5.0 JestTest',
        );
        expect(requestContextService.getDurationMs()).toBeGreaterThanOrEqual(
          50,
        );
        done();
      });
    });
  });

  describe('TransformInterceptor', () => {
    it('should envelope standard objects with success: true and metadata', (done) => {
      const interceptor = new TransformInterceptor(
        reflector,
        requestContextService,
      );
      const context: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
      };
      const callHandler: any = {
        handle: () => of({ message: 'hello world' }),
      };

      const store: RequestContextStore = {
        correlationId: 'envelope-test-id',
        startTime: Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        path: '/api/v1/greeting',
        method: 'GET',
      };

      RequestContextService.run(store, () => {
        interceptor.intercept(context, callHandler).subscribe((result: any) => {
          expect(result.success).toBe(true);
          expect(result.data).toEqual({ message: 'hello world' });
          expect(result.meta.correlationId).toBe('envelope-test-id');
          expect(result.meta.path).toBe('/api/v1/greeting');
          expect(result.meta.timestamp).toBeDefined();
          done();
        });
      });
    });

    it('should extract pagination metadata for PaginatedResult', (done) => {
      const interceptor = new TransformInterceptor(
        reflector,
        requestContextService,
      );
      const context: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
      };
      const paginated = new PaginatedResult(['item1', 'item2'], 50, 1, 10);
      const callHandler: any = {
        handle: () => of(paginated),
      };

      interceptor.intercept(context, callHandler).subscribe((result: any) => {
        expect(result.success).toBe(true);
        expect(result.data).toEqual(['item1', 'item2']);
        expect(result.meta.pagination).toBeDefined();
        expect(result.meta.pagination.page).toBe(1);
        expect(result.meta.pagination.pageSize).toBe(10);
        expect(result.meta.pagination.total).toBe(50);
        expect(result.meta.pagination.totalPages).toBe(5);
        expect(result.meta.pagination.hasNext).toBe(true);
        expect(result.meta.pagination.hasPrevious).toBe(false);
        done();
      });
    });
  });

  describe('Pagination & Sorting Helpers', () => {
    it('should calculate offset correctly', () => {
      const dto = new PaginationQueryDto();
      dto.page = 3;
      dto.pageSize = 20;
      expect(dto.offset).toBe(40);
    });

    it('should sanitize sort column safely', () => {
      const allowed = ['CreatedAt', 'Username', 'Email'];
      expect(sanitizeSortColumn('email', allowed, 'CreatedAt')).toBe('Email');
      expect(
        sanitizeSortColumn('DROP TABLE Users;--', allowed, 'CreatedAt'),
      ).toBe('CreatedAt');
      expect(sanitizeSortColumn(undefined, allowed, 'CreatedAt')).toBe(
        'CreatedAt',
      );
    });
  });

  describe('Filtering Framework', () => {
    it('should parse shorthand filter strings correctly', () => {
      const shorthand =
        'EventType:EQ:LOGIN_FAILURE,CreatedAt:GTE:2026-08-01,Status:IN:ACTIVE|PENDING';
      const parsed = parseFilterQuery(shorthand);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({
        field: 'EventType',
        operator: FilterOperator.EQ,
        value: 'LOGIN_FAILURE',
      });
      expect(parsed[1]).toEqual({
        field: 'CreatedAt',
        operator: FilterOperator.GTE,
        value: '2026-08-01',
      });
      expect(parsed[2]).toEqual({
        field: 'Status',
        operator: FilterOperator.IN,
        value: ['ACTIVE', 'PENDING'],
      });
    });

    it('should parse JSON filter strings correctly', () => {
      const jsonStr = JSON.stringify([
        { field: 'Role', operator: 'EQ', value: 'SYSTEM_ADMIN' },
        { field: 'Attempts', operator: 'GT', value: 3 },
      ]);
      const parsed = parseFilterQuery(jsonStr);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        field: 'Role',
        operator: 'EQ',
        value: 'SYSTEM_ADMIN',
      });
      expect(parsed[1]).toEqual({
        field: 'Attempts',
        operator: 'GT',
        value: 3,
      });
    });

    it('should build parameterized SQL Server WHERE clause safely with column whitelisting', () => {
      const filters = [
        {
          field: 'eventType',
          operator: FilterOperator.EQ,
          value: 'LOGIN_SUCCESS',
        },
        { field: 'userId', operator: FilterOperator.EQ, value: 'usr-123' },
        {
          field: 'createdAt',
          operator: FilterOperator.GTE,
          value: '2026-08-01T00:00:00Z',
        },
        {
          field: 'status',
          operator: FilterOperator.IN,
          value: ['ACTIVE', 'LOCKED'],
        },
        {
          field: 'maliciousColumn',
          operator: FilterOperator.EQ,
          value: 'hack',
        }, // not in whitelist
      ];

      const allowedColumns = {
        eventType: 'e.EventType',
        userId: 'e.UserID',
        createdAt: 'e.CreatedAt',
        status: 'u.Status',
      };

      const result = buildWhereClause({
        filters,
        allowedColumns,
        defaultWhere: 'e.IsDeleted = 0',
        startIndex: 0,
      });

      expect(result.whereClause).toBe(
        'WHERE e.IsDeleted = 0 AND e.EventType = @0 AND e.UserID = @1 AND e.CreatedAt >= @2 AND u.Status IN (@3, @4)',
      );
      expect(result.params).toEqual([
        'LOGIN_SUCCESS',
        'usr-123',
        '2026-08-01T00:00:00Z',
        'ACTIVE',
        'LOCKED',
      ]);
    });
  });

  describe('GlobalHttpExceptionFilter', () => {
    it('should format HttpException as standard ErrorEnvelope', () => {
      const filter = new GlobalHttpExceptionFilter(requestContextService);
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });

      const host: any = {
        switchToHttp: () => ({
          getResponse: () => ({ status: mockStatus }),
          getRequest: () => ({
            originalUrl: '/api/v1/bad-request',
            url: '/api/v1/bad-request',
          }),
        }),
      };

      const exception = new BadRequestException(
        'Validation failed on field email',
      );
      filter.catch(exception, host);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'BAD_REQUEST',
            message: 'Validation failed on field email',
          }),
          meta: expect.objectContaining({
            path: '/api/v1/bad-request',
          }),
        }),
      );
    });
  });

  describe('RateLimitGuard', () => {
    let guard: RateLimitGuard;
    let mockSecurityEventsService: Partial<SecurityEventsService>;

    beforeEach(() => {
      mockSecurityEventsService = {
        log: jest.fn().mockResolvedValue(undefined),
      };
      guard = new RateLimitGuard(
        reflector,
        requestContextService,
        mockSecurityEventsService as SecurityEventsService,
      );
    });

    it('should allow requests within limit and set rate limit headers', async () => {
      const mockHeaders: Record<string, any> = {};
      const context: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getResponse: () => ({
            setHeader: (k: string, v: any) => {
              mockHeaders[k] = v;
            },
          }),
        }),
      };

      const store: RequestContextStore = {
        correlationId: 'rate-test',
        startTime: Date.now(),
        ipAddress: '10.0.0.1',
        userAgent: 'Jest',
        path: '/api/v1/test',
        method: 'GET',
      };

      await RequestContextService.run(store, async () => {
        const canActivate = await guard.canActivate(context);
        expect(canActivate).toBe(true);
        expect(mockHeaders['X-RateLimit-Limit']).toBeDefined();
        expect(mockHeaders['X-RateLimit-Remaining']).toBeDefined();
      });
    });
  });
});
