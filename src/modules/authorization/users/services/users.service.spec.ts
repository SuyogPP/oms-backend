import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsersService } from './users.service';
import { UsersRepository } from '../repositories/users.repository';
import { UserProfilesRepository } from '../repositories/user-profiles.repository';
import { UserInvitationsRepository } from '../repositories/user-invitations.repository';
import { UserValidationService } from './user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { USER_TYPES } from '../users.constants';
import { UserFilterDto } from '../dto/user-filter.dto';

describe('UsersService (Domain 3, §§5.1, 5.2, 8, 9.2)', () => {
  let service: UsersService;
  let usersRepository: UsersRepository;
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
    query: jest.fn(),
  };

  const mockUsersRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    exportUsers: jest.fn(),
    getUserActivity: jest.fn(),
  };

  const mockUserProfilesRepository = {
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockUserInvitationsRepository = {
    create: jest.fn(),
  };

  const mockValidationService = {
    validateCreateUser: jest.fn().mockResolvedValue(undefined),
    validateUpdateUser: jest.fn().mockResolvedValue(undefined),
  };

  const mockSecurityEventsService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logUserCreated: jest.fn().mockResolvedValue(undefined),
    logUserUpdated: jest.fn().mockResolvedValue(undefined),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const requesterUserId = '2053433E-F36B-1410-85ED-009A959FB233';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: UserProfilesRepository, useValue: mockUserProfilesRepository },
        { provide: UserInvitationsRepository, useValue: mockUserInvitationsRepository },
        { provide: UserValidationService, useValue: mockValidationService },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    validationService = module.get<UserValidationService>(UserValidationService);
    securityEventsService = module.get<SecurityEventsService>(SecurityEventsService);
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('1. findAll (List, Search, Filters, Scope Enforcement)', () => {
    it('delegates query with pagination and filters to UsersRepository', async () => {
      mockUsersRepository.findAll.mockResolvedValueOnce({
        items: [
          {
            userId: sampleUserId,
            username: 'tariq.hashimi',
            email: 'tariq@diez.ae',
            userType: USER_TYPES.INTERNAL,
            isActive: true,
            isDeleted: false,
            failedLoginCount: 0,
            status: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            profile: null,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const filter: UserFilterDto = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        search: 'tariq',
        status: 'ACTIVE',
        role: 'HOD',
        hasNoRole: false,
      };

      const response = await service.findAll(filter, requesterUserId);

      expect(response.total).toBe(1);
      expect(response.items[0].username).toBe('tariq.hashimi');
      expect(mockUsersRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'tariq',
          status: 'ACTIVE',
          role: 'HOD',
          hasNoRole: false,
          requesterUserId,
        }),
      );
    });
  });

  describe('2. findById (Scope Enforcement & 404 Behavior)', () => {
    it('returns 404 if user not found in database', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce(null);

      await expect(service.findById(sampleUserId, requesterUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 404 (never 403) when user is outside requester visible scope', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'outside.user',
        email: 'outside@diez.ae',
        userType: USER_TYPES.INTERNAL,
        isActive: true,
        isDeleted: false,
        profile: {
          departmentId: 'dept-other-branch',
        },
      });

      // Requester has no GLOBAL scope
      mockDataSource.query.mockResolvedValueOnce([]);
      // Visible subtree does not contain dept-other-branch
      mockDataSource.query.mockResolvedValueOnce([]);

      await expect(service.findById(sampleUserId, requesterUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns user details when requester holds GLOBAL scope', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'any.user',
        email: 'any@diez.ae',
        userType: USER_TYPES.INTERNAL,
        isActive: true,
        isDeleted: false,
        profile: {
          departmentId: 'dept-any',
        },
      });

      // Requester holds GLOBAL scope
      mockDataSource.query.mockResolvedValueOnce([{ 1: 1 }]);

      const result = await service.findById(sampleUserId, requesterUserId);
      expect(result.userId).toBe(sampleUserId);
      expect(result.username).toBe('any.user');
    });
  });

  describe('3. create (Transactional User Creation §5.1)', () => {
    it('creates User, Profile, Invitation Token, SecurityEvent, and Audit Log atomically', async () => {
      const dto = {
        employeeId: 'EMP-0123',
        username: 'layla.mansoori',
        email: 'layla@diez.ae',
        userType: USER_TYPES.INTERNAL,
        profile: {
          firstName: 'Layla',
          lastName: 'Al Mansoori',
          departmentId: '1053433E-F36B-1410-85ED-009A959FB122',
        },
      };

      mockUsersRepository.create.mockResolvedValueOnce(sampleUserId);
      mockUserProfilesRepository.create.mockResolvedValueOnce('prof-123');
      mockUserInvitationsRepository.create.mockResolvedValueOnce('inv-123');
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        employeeId: 'EMP-0123',
        username: 'layla.mansoori',
        email: 'layla@diez.ae',
        userType: USER_TYPES.INTERNAL,
        isActive: false,
        isDeleted: false,
        profile: {
          firstName: 'Layla',
          lastName: 'Al Mansoori',
        },
      });

      const result = await service.create(dto, requesterUserId);

      // Validation was executed
      expect(mockValidationService.validateCreateUser).toHaveBeenCalledWith(dto, requesterUserId);

      // Transaction committed
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

      // Repositories called with queryRunner
      expect(mockUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'layla.mansoori', email: 'layla@diez.ae' }),
        mockQueryRunner,
      );
      expect(mockUserProfilesRepository.create).toHaveBeenCalledWith(
        sampleUserId,
        expect.objectContaining({ firstName: 'Layla', lastName: 'Al Mansoori' }),
        mockQueryRunner,
      );
      expect(mockUserInvitationsRepository.create).toHaveBeenCalledWith(
        sampleUserId,
        expect.any(String),
        'INVITE',
        expect.any(Date),
        requesterUserId,
        mockQueryRunner,
      );

      // Security and Audit logged
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith('USER_CREATED', expect.any(Object));
      expect(mockAuditService.logUserCreated).toHaveBeenCalledWith(expect.objectContaining({ userId: sampleUserId }));

      // Token generated
      expect(result.invitationToken).toBeDefined();
      expect(result.user.username).toBe('layla.mansoori');
    });

    it('rolls back transaction if profile insertion fails', async () => {
      const dto = {
        username: 'fail.user',
        email: 'fail@diez.ae',
        userType: USER_TYPES.INTERNAL,
        profile: { firstName: 'Fail', lastName: 'User' },
      };

      mockUsersRepository.create.mockResolvedValueOnce(sampleUserId);
      mockUserProfilesRepository.create.mockRejectedValueOnce(new Error('DB Constraint Violation'));

      await expect(service.create(dto, requesterUserId)).rejects.toThrow('DB Constraint Violation');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('4. update (Transactional Updates & Audit Trail)', () => {
    it('validates and updates user core fields and profile', async () => {
      mockUsersRepository.findById.mockResolvedValue({
        userId: sampleUserId,
        username: 'tariq.hashimi',
        email: 'tariq@diez.ae',
        userType: USER_TYPES.INTERNAL,
        isActive: true,
        isDeleted: false,
        profile: null,
      });

      // Requester has global scope
      mockDataSource.query.mockResolvedValueOnce([{ 1: 1 }]);

      const dto = {
        email: 'tariq.new@diez.ae',
        profile: { jobTitle: 'Chief Financial Officer' },
      };

      const result = await service.update(sampleUserId, dto, requesterUserId);

      expect(mockValidationService.validateUpdateUser).toHaveBeenCalledWith(sampleUserId, dto, requesterUserId);
      expect(mockUsersRepository.update).toHaveBeenCalledWith(sampleUserId, expect.objectContaining({ email: 'tariq.new@diez.ae' }), mockQueryRunner);
      expect(mockUserProfilesRepository.update).toHaveBeenCalledWith(sampleUserId, expect.objectContaining({ jobTitle: 'Chief Financial Officer' }), mockQueryRunner);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith('USER_UPDATED', expect.any(Object));
      expect(mockAuditService.logUserUpdated).toHaveBeenCalledWith(expect.objectContaining({ userId: sampleUserId }));
    });
  });

  describe('5. exportUsers & getUserActivity', () => {
    it('exportUsers returns unpaginated user records', async () => {
      mockUsersRepository.exportUsers.mockResolvedValueOnce([
        {
          userId: sampleUserId,
          username: 'export.user',
          email: 'export@diez.ae',
          userType: USER_TYPES.INTERNAL,
          isActive: true,
          isDeleted: false,
          profile: null,
        },
      ]);

      const list = await service.exportUsers(
        { search: 'export', page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'DESC' },
        requesterUserId,
      );
      expect(list.length).toBe(1);
      expect(list[0].username).toBe('export.user');
    });

    it('getUserActivity returns audit trail for visible user', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'activity.user',
        email: 'act@diez.ae',
        userType: USER_TYPES.INTERNAL,
        isActive: true,
        isDeleted: false,
        profile: null,
      });

      mockDataSource.query.mockResolvedValueOnce([{ 1: 1 }]); // global scope

      mockUsersRepository.getUserActivity.mockResolvedValueOnce([
        { eventId: 'evt-1', userId: sampleUserId, eventType: 'USER_LOGIN', description: 'Success' },
      ]);

      const events = await service.getUserActivity(sampleUserId, requesterUserId);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('USER_LOGIN');
    });
  });
});
