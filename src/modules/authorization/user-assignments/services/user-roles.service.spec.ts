import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserRolesService } from './user-roles.service';
import { UserRolesRepository } from '../repositories/user-roles.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { UserValidationService } from '../../users/services/user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { USER_ERROR_CODES } from '../../users/users.constants';

describe('UserRolesService (Domain 3, Section 8 Assignments & Section 4.2)', () => {
  let service: UserRolesService;
  let userRolesRepository: UserRolesRepository;
  let usersRepository: UsersRepository;
  let validationService: UserValidationService;
  let securityEventsService: SecurityEventsService;
  let auditService: AuditService;

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockUserRolesRepository = {
    findByUserId: jest.fn(),
    findActiveByUserId: jest.fn(),
    findById: jest.fn(),
    assignRole: jest.fn(),
    revokeRole: jest.fn(),
    hasActiveRole: jest.fn(),
    findRoleByIdOrCode: jest.fn().mockResolvedValue({
      roleId: '3053433E-F36B-1410-85ED-009A959FB344',
      roleCode: 'HOD',
      roleName: 'Head of Department',
      isSystemRole: true,
      isActive: true,
    }),
    findAllRoles: jest.fn().mockResolvedValue([]),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
  };

  const mockValidationService = {
    validateAssignRole: jest.fn().mockResolvedValue(undefined),
    validateRevokeRole: jest.fn(),
  };

  const mockSecurityEventsService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logUserUpdated: jest.fn().mockResolvedValue(undefined),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const operatorUserId = '2053433E-F36B-1410-85ED-009A959FB233';
  const roleId = '3053433E-F36B-1410-85ED-009A959FB344';
  const userRoleId = '4053433E-F36B-1410-85ED-009A959FB455';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRolesService,
        { provide: UserRolesRepository, useValue: mockUserRolesRepository },
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: UserValidationService, useValue: mockValidationService },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserRolesService>(UserRolesService);
    userRolesRepository = module.get<UserRolesRepository>(UserRolesRepository);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    validationService = module.get<UserValidationService>(
      UserValidationService,
    );
    securityEventsService = module.get<SecurityEventsService>(
      SecurityEventsService,
    );
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('1. findByUserId (Scope & Visibility)', () => {
    it('returns role assignments when target user is visible', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        isDeleted: false,
      });

      // Requester holds global scope
      mockDataSource.query.mockResolvedValueOnce([{ 1: 1 }]);

      mockUserRolesRepository.findByUserId.mockResolvedValueOnce([
        {
          userRoleId,
          userId: sampleUserId,
          roleId,
          roleCode: 'HOD',
          roleName: 'Head of Department',
          isSystemRole: false,
          effectiveFrom: new Date(),
          effectiveTo: null,
          isActive: true,
          assignedBy: operatorUserId,
          assignedAt: new Date(),
        },
      ]);

      const result = await service.findByUserId(sampleUserId, operatorUserId);
      expect(result.length).toBe(1);
      expect(result[0].roleCode).toBe('HOD');
    });

    it('throws 404 when target user is out of requester scope', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        isDeleted: false,
        profile: { departmentId: 'other-dept' },
      });

      // Requester not global admin
      mockDataSource.query.mockResolvedValueOnce([]);
      // Visible org units query returns empty
      mockDataSource.query.mockResolvedValueOnce([]);

      await expect(
        service.findByUserId(sampleUserId, operatorUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. assignRole (Temporal & Validation Invariants)', () => {
    it('successfully assigns a role, recording temporal fields, security event, and audit log', async () => {
      mockUserRolesRepository.assignRole.mockResolvedValueOnce(userRoleId);
      mockUserRolesRepository.findById.mockResolvedValueOnce({
        userRoleId,
        userId: sampleUserId,
        roleId,
        roleCode: 'FINANCE_APPROVER',
        roleName: 'Finance Approver',
        isSystemRole: false,
        effectiveFrom: new Date('2026-09-01T00:00:00Z'),
        effectiveTo: new Date('2027-09-01T00:00:00Z'),
        isActive: true,
        assignedBy: operatorUserId,
        assignedAt: new Date(),
      });

      const dto = {
        roleId,
        effectiveFrom: '2026-09-01T00:00:00.000Z',
        effectiveTo: '2027-09-01T00:00:00.000Z',
      };

      const result = await service.assignRole(
        sampleUserId,
        dto,
        operatorUserId,
      );

      // Validation was executed
      expect(mockValidationService.validateAssignRole).toHaveBeenCalledWith(
        sampleUserId,
        roleId,
        operatorUserId,
      );

      // Repository called with temporal fields
      expect(mockUserRolesRepository.assignRole).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sampleUserId,
          roleId,
          effectiveFrom: expect.any(Date),
          effectiveTo: expect.any(Date),
          assignedBy: operatorUserId,
        }),
      );

      // Security and Audit logged
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'ROLE_ASSIGNED',
        expect.any(Object),
      );
      expect(mockAuditService.logUserUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ userId: sampleUserId }),
      );

      expect(result.roleCode).toBe('FINANCE_APPROVER');
    });

    it('rejects self-assignment of roles with 409 USER_SELF_ACTION (§9.1 / U14)', async () => {
      mockValidationService.validateAssignRole.mockRejectedValueOnce(
        new ConflictException({
          code: USER_ERROR_CODES.USER_SELF_ACTION,
          message: 'Cannot assign roles to yourself.',
        }),
      );

      await expect(
        service.assignRole(operatorUserId, { roleId }, operatorUserId),
      ).rejects.toThrow(ConflictException);

      expect(mockUserRolesRepository.assignRole).not.toHaveBeenCalled();
    });

    it('rejects assigning internal role to vendor user with 400 VENDOR_ROLE_INVALID (V3)', async () => {
      mockValidationService.validateAssignRole.mockRejectedValueOnce(
        new BadRequestException({
          code: USER_ERROR_CODES.VENDOR_ROLE_INVALID,
          message: 'Vendor users cannot be assigned internal roles.',
        }),
      );

      await expect(
        service.assignRole(sampleUserId, { roleId }, operatorUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockUserRolesRepository.assignRole).not.toHaveBeenCalled();
    });
  });

  describe('3. revokeRole (Section 4.2 Revocation Semantics & Self-Action Guard)', () => {
    it('revokes role assignment by setting EffectiveTo = now without setting IsActive = 0 per §4.2', async () => {
      mockUserRolesRepository.findById.mockResolvedValueOnce({
        userRoleId,
        userId: sampleUserId,
        roleId,
        roleCode: 'HOD',
        isActive: true,
      });

      await service.revokeRole(userRoleId, operatorUserId);

      // Revoke sets EffectiveTo = now; does NOT set IsActive = 0
      expect(mockUserRolesRepository.revokeRole).toHaveBeenCalledWith(
        userRoleId,
      );

      // Security event & Audit logged
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'ROLE_REVOKED',
        expect.any(Object),
      );
      expect(mockAuditService.logUserUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ userId: sampleUserId }),
      );
    });

    it('rejects revoking your own role with 409 USER_SELF_ACTION (§9.1 / U14)', async () => {
      mockUserRolesRepository.findById.mockResolvedValueOnce({
        userRoleId,
        userId: operatorUserId, // Own assignment
        roleId,
        roleCode: 'SYSTEM_ADMIN',
        isActive: true,
      });

      await expect(
        service.revokeRole(userRoleId, operatorUserId),
      ).rejects.toThrow(ConflictException);

      expect(mockUserRolesRepository.revokeRole).not.toHaveBeenCalled();
    });

    it('throws 404 if role assignment record does not exist', async () => {
      mockUserRolesRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.revokeRole('non-existent-id', operatorUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Fresh Per-Request Permission Resolution (Immediate Effect Without Re-login)', () => {
    it('asserts that newly assigned active role takes immediate effect on subsequent request resolution', async () => {
      // Step 1: User has NO active roles initially
      mockUserRolesRepository.findActiveByUserId.mockResolvedValueOnce([]);
      const initialRoles =
        await userRolesRepository.findActiveByUserId(sampleUserId);
      expect(initialRoles.length).toBe(0);

      // Step 2: Administrator assigns HOD role to user
      mockUserRolesRepository.assignRole.mockResolvedValueOnce(userRoleId);
      mockUserRolesRepository.findById.mockResolvedValueOnce({
        userRoleId,
        userId: sampleUserId,
        roleId,
        roleCode: 'HOD',
        roleName: 'Head of Department',
        isSystemRole: false,
        effectiveFrom: new Date(Date.now() - 1000), // Active now
        effectiveTo: null,
        isActive: true,
        assignedBy: operatorUserId,
        assignedAt: new Date(),
      });

      await service.assignRole(sampleUserId, { roleId }, operatorUserId);

      // Step 3: Immediate subsequent resolution returns active HOD role without re-login
      mockUserRolesRepository.findActiveByUserId.mockResolvedValueOnce([
        {
          userRoleId,
          userId: sampleUserId,
          roleId,
          roleCode: 'HOD',
          roleName: 'Head of Department',
          isSystemRole: false,
          effectiveFrom: new Date(Date.now() - 1000),
          effectiveTo: null,
          isActive: true,
          assignedBy: operatorUserId,
          assignedAt: new Date(),
        },
      ]);

      const subsequentRoles =
        await userRolesRepository.findActiveByUserId(sampleUserId);
      expect(subsequentRoles.length).toBe(1);
      expect(subsequentRoles[0].roleCode).toBe('HOD');
    });
  });
});
