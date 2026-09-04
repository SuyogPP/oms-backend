import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserLifecycleService } from './user-lifecycle.service';
import { UsersRepository } from '../repositories/users.repository';
import { UserRolesRepository } from '../../user-assignments/repositories/user-roles.repository';
import { DelegationsRepository } from '../../delegations/repositories/delegations.repository';
import { UserValidationService } from './user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';

describe('UserLifecycleService (Domain 3, §§5.5, 9.1)', () => {
  let service: UserLifecycleService;
  let usersRepository: UsersRepository;
  let userRolesRepository: UserRolesRepository;
  let delegationsRepository: DelegationsRepository;
  let validationService: UserValidationService;
  let securityEventsService: SecurityEventsService;
  let auditService: AuditService;

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
    activate: jest.fn(),
    deactivate: jest.fn(),
    softDelete: jest.fn(),
    revokeAllUserSessions: jest.fn(),
  };

  const mockUserRolesRepository = {
    revokeAllForUser: jest.fn(),
  };

  const mockDelegationsRepository = {
    endAllForUser: jest.fn(),
  };

  const mockValidationService = {
    validateDeactivateUser: jest.fn().mockResolvedValue(undefined),
    validateDeleteUser: jest.fn().mockResolvedValue(undefined),
  };

  const mockSecurityEventsService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logUserStatusChanged: jest.fn().mockResolvedValue(undefined),
    logUserDeleted: jest.fn().mockResolvedValue(undefined),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const operatorUserId = '2053433E-F36B-1410-85ED-009A959FB233';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserLifecycleService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: UserRolesRepository, useValue: mockUserRolesRepository },
        { provide: DelegationsRepository, useValue: mockDelegationsRepository },
        { provide: UserValidationService, useValue: mockValidationService },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserLifecycleService>(UserLifecycleService);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    userRolesRepository = module.get<UserRolesRepository>(UserRolesRepository);
    delegationsRepository = module.get<DelegationsRepository>(
      DelegationsRepository,
    );
    validationService = module.get<UserValidationService>(
      UserValidationService,
    );
    securityEventsService = module.get<SecurityEventsService>(
      SecurityEventsService,
    );
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('1. activate', () => {
    it('activates an inactive user and emits audit & security events', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'tariq.hashimi',
        isActive: false,
        isDeleted: false,
      });

      await service.activate(sampleUserId, operatorUserId);

      expect(mockUsersRepository.activate).toHaveBeenCalledWith(sampleUserId);
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'USER_ACTIVATED',
        expect.any(Object),
      );
      expect(mockAuditService.logUserStatusChanged).toHaveBeenCalledWith({
        userId: sampleUserId,
        isActive: true,
        reason: 'User account activated',
      });
    });

    it('returns without error if user is already active (idempotent)', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'tariq.hashimi',
        isActive: true,
        isDeleted: false,
      });

      await service.activate(sampleUserId, operatorUserId);
      expect(mockUsersRepository.activate).not.toHaveBeenCalled();
    });

    it('throws 404 if user does not exist or is soft-deleted', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.activate(sampleUserId, operatorUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. deactivate (U12 Preservation of Roles & Scope)', () => {
    it('deactivates user, revokes active sessions, and preserves role/scope assignments per U12', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'tariq.hashimi',
        isActive: true,
        isDeleted: false,
      });

      await service.deactivate(sampleUserId, operatorUserId);

      // Validations executed (U14 & U15)
      expect(mockValidationService.validateDeactivateUser).toHaveBeenCalledWith(
        sampleUserId,
        operatorUserId,
      );

      // Deactivated and sessions revoked inside transaction
      expect(mockUsersRepository.deactivate).toHaveBeenCalledWith(
        sampleUserId,
        mockQueryRunner,
      );
      expect(mockUsersRepository.revokeAllUserSessions).toHaveBeenCalledWith(
        sampleUserId,
        expect.any(String),
        mockQueryRunner,
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

      // U12 Guarantee: Roles and scopes were NOT revoked
      expect(mockUserRolesRepository.revokeAllForUser).not.toHaveBeenCalled();

      // Security and audit events logged
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'USER_DEACTIVATED',
        expect.any(Object),
      );
      expect(mockAuditService.logUserStatusChanged).toHaveBeenCalledWith({
        userId: sampleUserId,
        isActive: false,
        reason: 'User account deactivated',
      });
    });
  });

  describe('3. softDelete (Full Atomic Tear-Down §5.5 & §9.1)', () => {
    it('soft-deletes user, revokes sessions, ends roles, and ends delegations in a single transaction', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'tariq.hashimi',
        isActive: true,
        isDeleted: false,
      });

      await service.softDelete(sampleUserId, operatorUserId);

      // Validations executed (U14, U15, U16)
      expect(mockValidationService.validateDeleteUser).toHaveBeenCalledWith(
        sampleUserId,
        operatorUserId,
      );

      // Transaction steps
      expect(mockUsersRepository.softDelete).toHaveBeenCalledWith(
        sampleUserId,
        operatorUserId,
        mockQueryRunner,
      );
      expect(mockUsersRepository.revokeAllUserSessions).toHaveBeenCalledWith(
        sampleUserId,
        expect.any(String),
        mockQueryRunner,
      );
      expect(mockUserRolesRepository.revokeAllForUser).toHaveBeenCalledWith(
        sampleUserId,
        mockQueryRunner,
      );
      expect(mockDelegationsRepository.endAllForUser).toHaveBeenCalledWith(
        sampleUserId,
        mockQueryRunner,
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

      // Events logged
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'USER_DELETED',
        expect.any(Object),
      );
      expect(mockAuditService.logUserDeleted).toHaveBeenCalledWith({
        userId: sampleUserId,
      });
    });

    it('rolls back transaction if ending delegations fails during deletion', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'tariq.hashimi',
        isActive: true,
        isDeleted: false,
      });

      mockDelegationsRepository.endAllForUser.mockRejectedValueOnce(
        new Error('Delegation SQL failure'),
      );

      await expect(
        service.softDelete(sampleUserId, operatorUserId),
      ).rejects.toThrow('Delegation SQL failure');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
