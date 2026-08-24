import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserScopesService } from './user-scopes.service';
import { UserScopesRepository } from '../repositories/user-scopes.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { UserValidationService } from '../../users/services/user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { USER_ERROR_CODES } from '../../users/users.constants';

describe('UserScopesService (Domain 3, Section 6 Rules S1-S8 & Section 8)', () => {
  let service: UserScopesService;
  let userScopesRepository: UserScopesRepository;
  let usersRepository: UsersRepository;
  let validationService: UserValidationService;
  let securityEventsService: SecurityEventsService;
  let auditService: AuditService;

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockUserScopesRepository = {
    findByUserId: jest.fn(),
    findActiveByUserId: jest.fn(),
    findById: jest.fn(),
    assignScope: jest.fn(),
    revokeScope: jest.fn(),
    countActiveByUserId: jest.fn(),
    countUnitsInScope: jest.fn(),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
  };

  const mockValidationService = {
    validateAssignScope: jest.fn().mockResolvedValue(undefined),
    validateRevokeScope: jest.fn(),
  };

  const mockSecurityEventsService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logUserUpdated: jest.fn().mockResolvedValue(undefined),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const operatorUserId = '2053433E-F36B-1410-85ED-009A959FB233';
  const scopeDefinitionId = '3053433E-F36B-1410-85ED-009A959FB344';
  const scopeId = '4053433E-F36B-1410-85ED-009A959FB455';
  const deptOrgUnitId = '5053433E-F36B-1410-85ED-009A959FB566';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserScopesService,
        { provide: UserScopesRepository, useValue: mockUserScopesRepository },
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: UserValidationService, useValue: mockValidationService },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserScopesService>(UserScopesService);
    userScopesRepository = module.get<UserScopesRepository>(UserScopesRepository);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    validationService = module.get<UserValidationService>(UserValidationService);
    securityEventsService = module.get<SecurityEventsService>(SecurityEventsService);
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('1. findByUserId (Scope-Enforced Listing)', () => {
    it('returns user scope assignments when target is in requester scope', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        isDeleted: false,
      });

      // Requester has global scope
      mockDataSource.query.mockResolvedValueOnce([{ 1: 1 }]);

      mockUserScopesRepository.findByUserId.mockResolvedValueOnce([
        {
          userOrganizationScopeId: scopeId,
          userId: sampleUserId,
          scopeDefinitionId,
          scopeCode: 'DEPARTMENT',
          scopeName: 'Department Level',
          orgUnitId: deptOrgUnitId,
          departmentId: deptOrgUnitId,
          effectiveFrom: new Date(),
          effectiveTo: null,
          isActive: true,
        },
      ]);

      const result = await service.findByUserId(sampleUserId, operatorUserId);
      expect(result.length).toBe(1);
      expect(result[0].scopeCode).toBe('DEPARTMENT');
    });

    it('throws 404 when target user is out of requester visible scope', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        isDeleted: false,
        profile: { departmentId: 'other-dept' },
      });

      mockDataSource.query.mockResolvedValueOnce([]); // not global
      mockDataSource.query.mockResolvedValueOnce([]); // not in visible org units

      await expect(service.findByUserId(sampleUserId, operatorUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('2. assignScope (Rules S1-S6 & U14)', () => {
    it('successfully assigns scope, writing temporal records, security event, and audit log', async () => {
      mockUserScopesRepository.assignScope.mockResolvedValueOnce(scopeId);
      mockUserScopesRepository.findById.mockResolvedValueOnce({
        userOrganizationScopeId: scopeId,
        userId: sampleUserId,
        scopeDefinitionId,
        scopeCode: 'DEPARTMENT',
        scopeName: 'Department Level',
        orgUnitId: deptOrgUnitId,
        departmentId: deptOrgUnitId,
        effectiveFrom: new Date(),
        effectiveTo: null,
        isActive: true,
      });

      const dto = {
        scopeDefinitionId,
        departmentId: deptOrgUnitId,
      };

      const result = await service.assignScope(sampleUserId, dto, operatorUserId);

      // Validation suite executed
      expect(mockValidationService.validateAssignScope).toHaveBeenCalledWith(
        sampleUserId,
        dto,
        operatorUserId,
      );

      // Assignment persisted
      expect(mockUserScopesRepository.assignScope).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sampleUserId,
          scopeDefinitionId,
          departmentId: deptOrgUnitId,
        }),
      );

      // Security and audit logged
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith('SCOPE_ASSIGNED', expect.any(Object));
      expect(mockAuditService.logUserUpdated).toHaveBeenCalledWith(expect.objectContaining({ userId: sampleUserId }));

      expect(result.scopeCode).toBe('DEPARTMENT');
    });

    it('rejects self-assignment with 409 USER_SELF_ACTION (U14 / §9.1)', async () => {
      mockValidationService.validateAssignScope.mockRejectedValueOnce(
        new ConflictException({
          code: USER_ERROR_CODES.USER_SELF_ACTION,
          message: 'Cannot assign scope to yourself.',
        }),
      );

      await expect(
        service.assignScope(operatorUserId, { scopeDefinitionId }, operatorUserId),
      ).rejects.toThrow(ConflictException);

      expect(mockUserScopesRepository.assignScope).not.toHaveBeenCalled();
    });

    it('rejects broader scope escalation with 403 SCOPE_ESCALATION (S4)', async () => {
      mockValidationService.validateAssignScope.mockRejectedValueOnce(
        new ForbiddenException({
          code: USER_ERROR_CODES.SCOPE_ESCALATION,
          message: 'Cannot grant scope broader than your own.',
        }),
      );

      await expect(
        service.assignScope(sampleUserId, { scopeDefinitionId }, operatorUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects assigning organizational scope to vendor user (S5 / V4)', async () => {
      mockValidationService.validateAssignScope.mockRejectedValueOnce(
        new BadRequestException({
          code: USER_ERROR_CODES.SCOPE_VENDOR_NOT_ALLOWED,
          message: 'Vendor users cannot receive organizational scope.',
        }),
      );

      await expect(
        service.assignScope(sampleUserId, { scopeDefinitionId }, operatorUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. revokeScope (Rules S7 & S8, U14)', () => {
    it('revokes scope by setting EffectiveTo = now (S7: never hard delete)', async () => {
      mockUserScopesRepository.findById.mockResolvedValueOnce({
        userOrganizationScopeId: scopeId,
        userId: sampleUserId,
        scopeCode: 'DEPARTMENT',
      });
      mockUserScopesRepository.countActiveByUserId.mockResolvedValueOnce(2); // Has other active scope

      await service.revokeScope(scopeId, operatorUserId);

      // Validation executed
      expect(mockValidationService.validateRevokeScope).toHaveBeenCalledWith(
        sampleUserId,
        operatorUserId,
        2,
      );

      // S7: Sets EffectiveTo = now; does NOT delete
      expect(mockUserScopesRepository.revokeScope).toHaveBeenCalledWith(scopeId);

      // Events logged
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith('SCOPE_REVOKED', expect.any(Object));
      expect(mockAuditService.logUserUpdated).toHaveBeenCalledWith(expect.objectContaining({ userId: sampleUserId }));
    });

    it('rejects removing your own last remaining scope with 409 USER_LAST_ADMIN / SCOPE_ASSIGNMENT_INVALID (S8)', async () => {
      mockUserScopesRepository.findById.mockResolvedValueOnce({
        userOrganizationScopeId: scopeId,
        userId: operatorUserId, // Operator's own scope
        scopeCode: 'GLOBAL',
      });
      mockUserScopesRepository.countActiveByUserId.mockResolvedValueOnce(1); // Last scope

      mockValidationService.validateRevokeScope.mockImplementationOnce(() => {
        throw new ConflictException({
          code: USER_ERROR_CODES.USER_SELF_ACTION,
          message: 'Cannot remove your own last scope assignment.',
        });
      });

      await expect(service.revokeScope(scopeId, operatorUserId)).rejects.toThrow(
        ConflictException,
      );

      expect(mockUserScopesRepository.revokeScope).not.toHaveBeenCalled();
    });
  });

  describe('4. countProposedScopeUnits (UI Scope Impact Preview)', () => {
    it('returns exact count of accessible org units for subtree scope', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ ScopeCode: 'DEPARTMENT' }]);
      mockUserScopesRepository.countUnitsInScope.mockResolvedValueOnce(5);

      const preview = await service.countProposedScopeUnits(scopeDefinitionId, deptOrgUnitId);

      expect(preview.accessibleOrgUnitsCount).toBe(5);
      expect(preview.scopeCode).toBe('DEPARTMENT');
      expect(preview.orgUnitId).toBe(deptOrgUnitId);
    });

    it('returns count of all active org units for GLOBAL scope', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ ScopeCode: 'GLOBAL' }]);
      mockUserScopesRepository.countUnitsInScope.mockResolvedValueOnce(42);

      const preview = await service.countProposedScopeUnits(scopeDefinitionId, null);

      expect(preview.accessibleOrgUnitsCount).toBe(42);
      expect(preview.scopeCode).toBe('GLOBAL');
    });
  });
});
