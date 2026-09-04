import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserImportService } from './user-import.service';
import { UserImportRepository } from '../repositories/user-import.repository';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';

describe('UserImportService (Domain 3, Section 5.1, 6.2, Two-Phase Import)', () => {
  let service: UserImportService;
  let userImportRepository: UserImportRepository;
  let securityEventsService: SecurityEventsService;
  let auditService: AuditService;

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    query: jest.fn(),
  };

  const mockUserImportRepository = {
    findExistingEmails: jest.fn().mockResolvedValue([]),
    findExistingUsernames: jest.fn().mockResolvedValue([]),
    findExistingEmployeeIds: jest.fn().mockResolvedValue([]),
    findOrgUnitsByCodes: jest.fn().mockResolvedValue([]),
    findRolesByCodes: jest.fn().mockResolvedValue([]),
    findScopeDefinitions: jest.fn().mockResolvedValue([]),
  };

  const mockSecurityEventsService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logUserCreated: jest.fn().mockResolvedValue(undefined),
  };

  const operatorUserId = '3053433E-F36B-1410-85ED-009A959FB344';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserImportService,
        { provide: UserImportRepository, useValue: mockUserImportRepository },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserImportService>(UserImportService);
    userImportRepository =
      module.get<UserImportRepository>(UserImportRepository);
    securityEventsService = module.get<SecurityEventsService>(
      SecurityEventsService,
    );
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('1. Batch Size & Empty Validations', () => {
    it('rejects batch exceeding 500 rows with 400 Bad Request', async () => {
      const rows = Array.from({ length: 501 }, (_, i) => ({
        rowNumber: i + 1,
        username: `user.${i}`,
        email: `user.${i}@diez.ae`,
        firstName: 'Test',
        lastName: 'User',
        employeeId: `EMP-${i}`,
      }));

      await expect(
        service.validateImport({ rows }, operatorUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty rows with 400 Bad Request', async () => {
      await expect(
        service.validateImport({ rows: [] }, operatorUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Phase 1: validateImport', () => {
    it('returns validation token when all rows are valid and caches payload', async () => {
      const validRows = [
        {
          rowNumber: 1,
          employeeId: 'EMP-1001',
          username: 'ali.rashid',
          email: 'ali.rashid@diez.ae',
          firstName: 'Ali',
          lastName: 'Rashid',
          departmentCode: 'DEP-PROC',
          roles: ['PROCUREMENT_BUYER'],
          scopeCode: 'DEPARTMENT',
          scopeUnitCode: 'DEP-PROC',
        },
      ];

      mockUserImportRepository.findOrgUnitsByCodes.mockResolvedValueOnce([
        {
          code: 'DEP-PROC',
          orgUnitId: 'dept-uuid',
          typeId: 3,
          name: 'Procurement',
        },
      ]);
      mockUserImportRepository.findRolesByCodes.mockResolvedValueOnce([
        {
          roleCode: 'PROCUREMENT_BUYER',
          roleId: 'role-uuid',
          isVendorRole: false,
        },
      ]);
      mockUserImportRepository.findScopeDefinitions.mockResolvedValueOnce([
        { scopeCode: 'DEPARTMENT', scopeDefinitionId: 'scope-def-uuid' },
      ]);

      const result = await service.validateImport(
        { rows: validRows },
        operatorUserId,
      );

      expect(result.totalRows).toBe(1);
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(0);
      expect(result.errors.length).toBe(0);
      expect(result.importToken).toMatch(/^imp_[a-f0-9]{32}$/);
    });

    it('identifies duplicate emails, usernames, and vendor roles in payload', async () => {
      const invalidRows = [
        {
          rowNumber: 1,
          employeeId: 'EMP-1001',
          username: 'ali.rashid',
          email: 'existing@diez.ae',
          firstName: 'Ali',
          lastName: 'Rashid',
        },
        {
          rowNumber: 2,
          employeeId: 'EMP-1002',
          username: 'sara.ahmed',
          email: 'sara@diez.ae',
          firstName: 'Sara',
          lastName: 'Ahmed',
          roles: ['VENDOR_ADMIN'], // V3 violation: vendor role for internal user
        },
        {
          rowNumber: 3,
          employeeId: 'EMP-1001', // Internal duplicate employee ID
          username: 'duplicate.emp',
          email: 'dup@diez.ae',
          firstName: 'Dup',
          lastName: 'Emp',
        },
      ];

      // Existing email in DB
      mockUserImportRepository.findExistingEmails.mockResolvedValueOnce([
        'existing@diez.ae',
      ]);
      mockUserImportRepository.findRolesByCodes.mockResolvedValueOnce([
        { roleCode: 'VENDOR_ADMIN', roleId: 'v-role-uuid', isVendorRole: true },
      ]);

      const result = await service.validateImport(
        { rows: invalidRows },
        operatorUserId,
      );

      expect(result.invalidRows).toBe(3);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
      expect(result.importToken).toBe(''); // No token generated on invalid batch
    });
  });

  describe('3. Phase 2: commitImport (All or Nothing & Invitation Generation)', () => {
    it('commits validated batch atomically, issuing invitations (never passwords) and logging events', async () => {
      const validRows = [
        {
          rowNumber: 1,
          employeeId: 'EMP-1001',
          username: 'ali.rashid',
          email: 'ali.rashid@diez.ae',
          firstName: 'Ali',
          lastName: 'Rashid',
        },
      ];

      const valResult = await service.validateImport(
        { rows: validRows },
        operatorUserId,
      );
      expect(valResult.importToken).toBeDefined();

      mockQueryRunner.query
        .mockResolvedValueOnce([{ userId: 'created-user-id-1' }]) // insert user
        .mockResolvedValueOnce([]) // insert profile
        .mockResolvedValueOnce([]); // insert invitation

      const commitResult = await service.commitImport(
        { importToken: valResult.importToken },
        operatorUserId,
      );

      expect(commitResult.importedCount).toBe(1);
      expect(commitResult.createdUserIds).toContain('created-user-id-1');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

      // Security Events logged: individual + batch summary
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'USER_INVITED_VIA_IMPORT',
        expect.objectContaining({ userId: 'created-user-id-1' }),
      );
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'USER_BATCH_IMPORTED',
        expect.any(Object),
      );

      // Audit Log called
      expect(mockAuditService.logUserCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'created-user-id-1',
          username: 'ali.rashid',
        }),
      );
    });

    it('rejects commit with expired or invalid token with 400 Bad Request', async () => {
      await expect(
        service.commitImport(
          { importToken: 'non-existent-token' },
          operatorUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rolls back entire transaction if any DB insert fails', async () => {
      const validRows = [
        {
          rowNumber: 1,
          employeeId: 'EMP-1001',
          username: 'ali.rashid',
          email: 'ali.rashid@diez.ae',
          firstName: 'Ali',
          lastName: 'Rashid',
        },
      ];

      const valResult = await service.validateImport(
        { rows: validRows },
        operatorUserId,
      );

      // Simulate DB crash during profile insert
      mockQueryRunner.query
        .mockResolvedValueOnce([{ userId: 'created-user-id-1' }])
        .mockRejectedValueOnce(new Error('DB Constraint Violation'));

      await expect(
        service.commitImport(
          { importToken: valResult.importToken },
          operatorUserId,
        ),
      ).rejects.toThrow('DB Constraint Violation');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('4. Downloadable Template', () => {
    it('returns CSV template with required column headers', () => {
      const csv = service.getTemplate();
      expect(csv).toContain(
        'employeeId,username,email,firstName,lastName,jobTitle,departmentCode,roles,scopeCode,scopeUnitCode',
      );
      expect(csv).toContain('EMP-1001');
      expect(csv).toContain('ali.rashid@diez.ae');
    });
  });
});
