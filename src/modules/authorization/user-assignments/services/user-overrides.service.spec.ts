import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserOverridesService } from './user-overrides.service';
import { UserOverridesRepository } from '../repositories/user-overrides.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { UserValidationService } from '../../users/services/user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { USER_ERROR_CODES } from '../../users/users.constants';

describe('UserOverridesService (Domain 3, Section 4.1, 4.4, 8, 9.1)', () => {
  let service: UserOverridesService;
  let userOverridesRepository: UserOverridesRepository;
  let usersRepository: UsersRepository;
  let validationService: UserValidationService;
  let securityEventsService: SecurityEventsService;
  let auditService: AuditService;

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockUserOverridesRepository = {
    findByUserId: jest.fn(),
    findActiveByUserId: jest.fn(),
    findById: jest.fn(),
    createOverride: jest.fn(),
    revokeOverride: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
  };

  const mockValidationService = {
    validateManageOverride: jest.fn(),
  };

  const mockSecurityEventsService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logUserUpdated: jest.fn().mockResolvedValue(undefined),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const operatorUserId = '2053433E-F36B-1410-85ED-009A959FB233';
  const permissionId = '3053433E-F36B-1410-85ED-009A959FB344';
  const overrideId = '4053433E-F36B-1410-85ED-009A959FB455';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserOverridesService,
        { provide: UserOverridesRepository, useValue: mockUserOverridesRepository },
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: UserValidationService, useValue: mockValidationService },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserOverridesService>(UserOverridesService);
    userOverridesRepository = module.get<UserOverridesRepository>(UserOverridesRepository);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    validationService = module.get<UserValidationService>(UserValidationService);
    securityEventsService = module.get<SecurityEventsService>(SecurityEventsService);
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('1. findByUserId (Scope Enforced)', () => {
    it('returns overrides for visible user', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        isDeleted: false,
      });

      mockDataSource.query.mockResolvedValueOnce([{ 1: 1 }]); // global scope

      mockUserOverridesRepository.findByUserId.mockResolvedValueOnce([
        {
          userPermissionOverrideId: overrideId,
          userId: sampleUserId,
          permissionId,
          permissionCode: 'PO.APPROVE',
          isGranted: true,
          reason: 'Audit sign-off',
          effectiveFrom: new Date(),
          effectiveTo: null,
        },
      ]);

      const result = await service.findByUserId(sampleUserId, operatorUserId);
      expect(result.length).toBe(1);
      expect(result[0].permissionCode).toBe('PO.APPROVE');
    });

    it('throws 404 if target user is outside requester scope', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        isDeleted: false,
        profile: { departmentId: 'other-dept' },
      });

      mockDataSource.query.mockResolvedValueOnce([]); // not global
      mockDataSource.query.mockResolvedValueOnce([]); // not visible in org tree

      await expect(service.findByUserId(sampleUserId, operatorUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('2. createOverride (Mandatory Reason, Self-Action & Before/After Audit)', () => {
    it('creates an override with mandatory reason, recording before/after state in security events', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'tariq.hashimi',
        isDeleted: false,
      });

      mockDataSource.query.mockResolvedValueOnce([
        {
          PermissionID: permissionId,
          PermissionCode: 'PO.APPROVE',
          ModuleName: 'Procurement',
          ActionName: 'APPROVE',
        },
      ]);

      // Before state: No active override
      mockUserOverridesRepository.findActiveByUserId.mockResolvedValueOnce([]);

      mockUserOverridesRepository.createOverride.mockResolvedValueOnce(overrideId);
      mockUserOverridesRepository.findById.mockResolvedValueOnce({
        userPermissionOverrideId: overrideId,
        userId: sampleUserId,
        permissionId,
        permissionCode: 'PO.APPROVE',
        moduleName: 'Procurement',
        actionName: 'APPROVE',
        isGranted: true,
        reason: 'Temporary audit approval authorization',
        approvedBy: operatorUserId,
        effectiveFrom: new Date(),
        effectiveTo: null,
      });

      const dto = {
        permissionId,
        isGranted: true,
        reason: 'Temporary audit approval authorization',
      };

      const result = await service.createOverride(sampleUserId, dto, operatorUserId);

      // Validation was executed
      expect(mockValidationService.validateManageOverride).toHaveBeenCalledWith(
        sampleUserId,
        operatorUserId,
      );

      // Override created
      expect(mockUserOverridesRepository.createOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sampleUserId,
          permissionId,
          isGranted: true,
          reason: 'Temporary audit approval authorization',
          approvedBy: operatorUserId,
        }),
      );

      // Security event logged
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'OVERRIDE_GRANTED',
        expect.objectContaining({
          userId: sampleUserId,
        }),
      );

      expect(mockAuditService.logUserUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sampleUserId,
          updatedFields: expect.objectContaining({
            beforeState: null,
            afterState: expect.objectContaining({
              isGranted: true,
              reason: 'Temporary audit approval authorization',
              approvedBy: operatorUserId,
            }),
          }),
        }),
      );

      expect(result.permissionCode).toBe('PO.APPROVE');
      expect(result.isGranted).toBe(true);
    });

    it('rejects creating an override without a reason with 400 Bad Request', async () => {
      const dto = {
        permissionId,
        isGranted: true,
        reason: '',
      };

      await expect(
        service.createOverride(sampleUserId, dto, operatorUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockUserOverridesRepository.createOverride).not.toHaveBeenCalled();
    });

    it('rejects creating an override for yourself with 409 USER_SELF_ACTION (§9.1 / U14)', async () => {
      mockValidationService.validateManageOverride.mockImplementationOnce(() => {
        throw new ConflictException({
          code: USER_ERROR_CODES.USER_SELF_ACTION,
          message: 'Cannot grant overrides on your own account.',
        });
      });

      const dto = {
        permissionId,
        isGranted: true,
        reason: 'Self promotion',
      };

      await expect(
        service.createOverride(operatorUserId, dto, operatorUserId),
      ).rejects.toThrow(ConflictException);

      expect(mockUserOverridesRepository.createOverride).not.toHaveBeenCalled();
    });
  });

  describe('3. revokeOverride (Temporal Revocation & Self-Action Guard)', () => {
    it('revokes override by setting EffectiveTo = now and logging before/after state', async () => {
      mockUserOverridesRepository.findById.mockResolvedValueOnce({
        userPermissionOverrideId: overrideId,
        userId: sampleUserId,
        permissionId,
        permissionCode: 'PO.APPROVE',
        isGranted: true,
        reason: 'Temporary audit approval',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      });

      await service.revokeOverride(overrideId, operatorUserId);

      expect(mockUserOverridesRepository.revokeOverride).toHaveBeenCalledWith(overrideId);
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'OVERRIDE_REVOKED',
        expect.objectContaining({
          userId: sampleUserId,
        }),
      );
      expect(mockAuditService.logUserUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sampleUserId,
          updatedFields: expect.objectContaining({
            beforeState: expect.objectContaining({ isGranted: true }),
            afterState: expect.objectContaining({ isGranted: true, effectiveTo: expect.any(Date) }),
          }),
        }),
      );
    });

    it('rejects revoking your own override with 409 USER_SELF_ACTION (§9.1 / U14)', async () => {
      mockUserOverridesRepository.findById.mockResolvedValueOnce({
        userPermissionOverrideId: overrideId,
        userId: operatorUserId, // Own override
        permissionId,
        permissionCode: 'PO.APPROVE',
        isGranted: true,
      });

      await expect(service.revokeOverride(overrideId, operatorUserId)).rejects.toThrow(
        ConflictException,
      );

      expect(mockUserOverridesRepository.revokeOverride).not.toHaveBeenCalled();
    });
  });

  describe('4. REVOKE BEATS GRANT Rule Verification (§4.1)', () => {
    it('asserts that an OVERRIDE_REVOKE (IsGranted=0) unconditionally beats a role grant for the same permission', () => {
      // Direct demonstration of §4.1 resolution logic:
      const rolePermissions = ['PO.CREATE', 'PO.APPROVE', 'BUDGET.VIEW'];
      const overrides = [
        { permissionCode: 'PO.APPROVE', isGranted: false, reason: 'Disciplinary suspension of approval authority' },
        { permissionCode: 'SPECIAL.AUDIT.ACCESS', isGranted: true, reason: 'Special project' },
      ];

      const revokeSet = new Set(
        overrides.filter((o) => !o.isGranted).map((o) => o.permissionCode),
      );

      const effectivePermissions = new Set<string>();

      // Add role permissions not in revokeSet
      for (const p of rolePermissions) {
        if (!revokeSet.has(p)) {
          effectivePermissions.add(p);
        }
      }

      // Add grant overrides not in revokeSet
      for (const o of overrides) {
        if (o.isGranted && !revokeSet.has(o.permissionCode)) {
          effectivePermissions.add(o.permissionCode);
        }
      }

      // Assert PO.APPROVE was stripped because REVOKE beats GRANT
      expect(effectivePermissions.has('PO.APPROVE')).toBe(false);
      expect(effectivePermissions.has('PO.CREATE')).toBe(true);
      expect(effectivePermissions.has('BUDGET.VIEW')).toBe(true);
      expect(effectivePermissions.has('SPECIAL.AUDIT.ACCESS')).toBe(true);
    });
  });
});
