import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DelegationsService } from './delegations.service';
import { DelegationsRepository } from '../repositories/delegations.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { USER_TYPES } from '../../users/users.constants';

describe('DelegationsService (Domain 3, Section 9.3 Rules D1-D7 & Section 8)', () => {
  let service: DelegationsService;
  let delegationsRepository: DelegationsRepository;
  let usersRepository: UsersRepository;
  let securityEventsService: SecurityEventsService;
  let auditService: AuditService;

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockDelegationsRepository = {
    findById: jest.fn(),
    findByToUserId: jest.fn(),
    findByFromUserId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    hasActiveOverlappingDelegation: jest.fn(),
    isCurrentlyActingDelegate: jest.fn(),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
  };

  const mockSecurityEventsService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logUserUpdated: jest.fn().mockResolvedValue(undefined),
  };

  const delegatorId = '1053433E-F36B-1410-85ED-009A959FB111';
  const delegateId = '2053433E-F36B-1410-85ED-009A959FB222';
  const adminUserId = '3053433E-F36B-1410-85ED-009A959FB333';
  const delegationId = '4053433E-F36B-1410-85ED-009A959FB444';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DelegationsService,
        { provide: DelegationsRepository, useValue: mockDelegationsRepository },
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DelegationsService>(DelegationsService);
    delegationsRepository = module.get<DelegationsRepository>(DelegationsRepository);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    securityEventsService = module.get<SecurityEventsService>(SecurityEventsService);
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('1. findMyDelegations (GET /me/delegations)', () => {
    it('returns both delegations granted by and received by the caller', async () => {
      const grantedDelegations = [
        {
          delegationId,
          fromUserId: delegatorId,
          toUserId: delegateId,
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-08-15'),
          reason: 'Annual leave',
          isActive: true,
        },
      ];
      const receivedDelegations = [
        {
          delegationId: 'other-del',
          fromUserId: 'other-user',
          toUserId: delegatorId,
          startDate: new Date('2026-08-10'),
          endDate: new Date('2026-08-20'),
          reason: 'Conference cover',
          isActive: true,
        },
      ];

      mockDelegationsRepository.findByFromUserId.mockResolvedValueOnce(grantedDelegations);
      mockDelegationsRepository.findByToUserId.mockResolvedValueOnce(receivedDelegations);

      const result = await service.findMyDelegations(delegatorId);

      expect(result.granted).toEqual(grantedDelegations);
      expect(result.received).toEqual(receivedDelegations);
      expect(mockDelegationsRepository.findByFromUserId).toHaveBeenCalledWith(delegatorId);
      expect(mockDelegationsRepository.findByToUserId).toHaveBeenCalledWith(delegatorId);
    });
  });

  describe('2. create (Rules D1-D7 Validation Suite)', () => {
    const validDto = {
      toUserId: delegateId,
      startDate: '2026-09-01T00:00:00Z',
      endDate: '2026-09-15T00:00:00Z',
      reason: 'Annual leave coverage',
    };

    it('creates delegation successfully for own account (self-management) recording dual-identity audit', async () => {
      // Delegate is active and INTERNAL
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: delegateId,
        userType: USER_TYPES.INTERNAL,
        isActive: true,
        isDeleted: false,
      });

      // No overlap and no chained delegation
      mockDelegationsRepository.hasActiveOverlappingDelegation.mockResolvedValueOnce(false);
      mockDelegationsRepository.isCurrentlyActingDelegate.mockResolvedValue(false);

      mockDelegationsRepository.create.mockResolvedValueOnce(delegationId);
      mockDelegationsRepository.findById.mockResolvedValueOnce({
        delegationId,
        fromUserId: delegatorId,
        toUserId: delegateId,
        startDate: validDto.startDate,
        endDate: validDto.endDate,
        reason: validDto.reason,
        isActive: true,
      });

      const result = await service.create(delegatorId, validDto, delegatorId);

      expect(mockDelegationsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUserId: delegatorId,
          toUserId: delegateId,
          reason: validDto.reason,
        }),
      );

      // D6: Dual identity audit logging
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'DELEGATION_CREATED',
        expect.objectContaining({ userId: delegatorId }),
      );
      expect(mockAuditService.logUserUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: delegatorId,
          updatedFields: expect.objectContaining({
            delegatorUserId: delegatorId,
            delegateUserId: delegateId,
            operatorUserId: delegatorId,
          }),
        }),
      );

      expect(result.delegationId).toBe(delegationId);
    });

    it('D1: rejects self-delegation (FromUserID == ToUserID)', async () => {
      const selfDto = {
        toUserId: delegatorId,
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-15T00:00:00Z',
        reason: 'Self delegation',
      };

      await expect(service.create(delegatorId, selfDto, delegatorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('D2: rejects endDate <= startDate', async () => {
      const invalidDatesDto = {
        toUserId: delegateId,
        startDate: '2026-09-15T00:00:00Z',
        endDate: '2026-09-01T00:00:00Z',
        reason: 'Invalid dates',
      };

      await expect(service.create(delegatorId, invalidDatesDto, delegatorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('D2: rejects duration exceeding 90 days', async () => {
      const longDto = {
        toUserId: delegateId,
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-06-01T00:00:00Z', // 151 days
        reason: 'Too long delegation',
      };

      await expect(service.create(delegatorId, longDto, delegatorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('D3: rejects overlapping active delegations from same user (409 Conflict)', async () => {
      mockDelegationsRepository.hasActiveOverlappingDelegation.mockResolvedValueOnce(true);

      await expect(service.create(delegatorId, validDto, delegatorId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('D4: rejects non-internal delegate (e.g. VENDOR)', async () => {
      mockDelegationsRepository.hasActiveOverlappingDelegation.mockResolvedValueOnce(false);
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: delegateId,
        userType: USER_TYPES.VENDOR,
        isActive: true,
        isDeleted: false,
      });

      await expect(service.create(delegatorId, validDto, delegatorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('D5: rejects chained delegation if delegator is currently an acting delegate', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: delegateId,
        userType: USER_TYPES.INTERNAL,
        isActive: true,
        isDeleted: false,
      });
      mockDelegationsRepository.hasActiveOverlappingDelegation.mockResolvedValueOnce(false);

      // Delegator is currently acting delegate
      mockDelegationsRepository.isCurrentlyActingDelegate.mockResolvedValueOnce(true);

      await expect(service.create(delegatorId, validDto, delegatorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Authorization: rejects non-admin creating delegation for another user (403 Forbidden)', async () => {
      // Caller is not delegator and has no USER.DELEGATION.MANAGE
      mockDataSource.query.mockResolvedValueOnce([]); // No admin permission

      await expect(service.create(delegatorId, validDto, 'unauthorized-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('3. cancel (Ending Delegation)', () => {
    it('cancels delegation setting IsActive = 0 and EndDate = now', async () => {
      mockDelegationsRepository.findById.mockResolvedValueOnce({
        delegationId,
        fromUserId: delegatorId,
        toUserId: delegateId,
        isActive: true,
      });

      await service.cancel(delegationId, delegatorId);

      expect(mockDelegationsRepository.cancel).toHaveBeenCalledWith(delegationId);
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'DELEGATION_CANCELLED',
        expect.objectContaining({ userId: delegatorId }),
      );
    });

    it('rejects non-owner non-admin cancelling delegation (403 Forbidden)', async () => {
      mockDelegationsRepository.findById.mockResolvedValueOnce({
        delegationId,
        fromUserId: delegatorId,
        toUserId: delegateId,
        isActive: true,
      });
      mockDataSource.query.mockResolvedValueOnce([]); // Not admin

      await expect(service.cancel(delegationId, 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
