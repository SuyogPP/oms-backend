import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AuditService } from '../../audit/service/audit.services';
import { ORG_MANAGER_ROLES } from '../org-units/org-units.constants';
import { OrgUnitChangeLogRepository } from '../org-units/repositories/org-unit-change-log.repository';
import { OrgUnitsRepository } from '../org-units/repositories/org-units.repository';
import { OrgUnitValidationService } from '../org-units/services/org-unit-validation.service';
import { OrgManagersMapper } from './org-managers.mapper';
import { OrgManagersRepository } from './repositories/org-managers.repository';
import { OrgManagersService } from './services/org-managers.service';

describe('OrgManagersService (Domain 2 — Section 7.4 & 8.3 Rules G1–G7)', () => {
  let service: OrgManagersService;
  let mockManagersRepo: any;
  let mockUnitsRepo: any;
  let mockValidationService: any;
  let mockChangeLogRepo: any;
  let mockAuditService: any;
  let mockDataSource: any;
  let mockQueryRunner: any;

  const sampleManager = {
    orgUnitManagerId: '88888888-9999-0000-1111-222222222222',
    orgUnitId: '77777777-8888-9999-0000-111111111111',
    userId: '1053433E-F36B-1410-85ED-009A959FB122',
    managerRoleCode: ORG_MANAGER_ROLES.HEAD,
    isPrimary: true,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    assignmentReason: 'HOD appointment',
    isActive: true,
    isDeleted: false,
    username: 'john.doe',
    userDisplayName: 'John Doe',
    userEmail: 'john.doe@diez.ae',
  };

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      query: jest.fn().mockResolvedValue([]),
    };

    mockManagersRepo = {
      findByUnitId: jest.fn().mockResolvedValue([sampleManager]),
      findCurrentHead: jest.fn().mockResolvedValue(sampleManager),
      findById: jest.fn().mockResolvedValue(sampleManager),
      findByUserId: jest.fn().mockResolvedValue([sampleManager]),
      create: jest.fn().mockResolvedValue(sampleManager),
      update: jest.fn().mockResolvedValue(sampleManager),
      endPreviousPrimaryHead: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue(undefined),
      getApprovalChain: jest.fn().mockResolvedValue([
        {
          step: 1,
          distance: 0,
          orgUnitId: 'u-1',
          orgUnitCode: 'IT_OPS',
          orgUnitName: 'IT Operations',
          orgUnitDepth: 3,
          head: {
            userId: 'user-ops',
            displayName: 'Ops Head',
            email: 'ops@diez.ae',
            managerRoleCode: 'HEAD',
          },
        },
        {
          step: 2,
          distance: 1,
          orgUnitId: 'u-2',
          orgUnitCode: 'IT',
          orgUnitName: 'Information Technology',
          orgUnitDepth: 2,
          head: {
            userId: 'user-it',
            displayName: 'IT Director',
            email: 'it@diez.ae',
            managerRoleCode: 'HEAD',
          },
        },
      ]),
    };

    mockUnitsRepo = {
      updateHeadUser: jest.fn().mockResolvedValue(undefined),
      findBudgetOwner: jest
        .fn()
        .mockResolvedValue({ orgUnitId: 'u-budget', allowsBudget: true }),
    };

    mockValidationService = {
      validateAssignManager: jest
        .fn()
        .mockResolvedValue({ unit: { orgUnitId: 'u-1' } }),
    };

    mockChangeLogRepo = {
      create: jest.fn().mockResolvedValue(1),
    };

    mockAuditService = {
      logOrgUnitChange: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgManagersService,
        OrgManagersMapper,
        { provide: OrgManagersRepository, useValue: mockManagersRepo },
        { provide: OrgUnitsRepository, useValue: mockUnitsRepo },
        { provide: OrgUnitValidationService, useValue: mockValidationService },
        { provide: OrgUnitChangeLogRepository, useValue: mockChangeLogRepo },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<OrgManagersService>(OrgManagersService);
  });

  describe('assignManager (Rules G1–G6)', () => {
    it('assigning new primary HEAD auto-ends previous HEAD (G2) and updates HeadUserId (G6) in same tx', async () => {
      const dto = {
        userId: '1053433E-F36B-1410-85ED-009A959FB122',
        managerRoleCode: ORG_MANAGER_ROLES.HEAD,
        isPrimary: true,
        effectiveFrom: '2026-09-01',
        assignmentReason: 'New HOD assignment',
      };

      const res = await service.assignManager('u-1', dto, 'actor-admin');

      // 1. Validation called with transaction runner
      expect(mockValidationService.validateAssignManager).toHaveBeenCalledWith(
        'u-1',
        dto,
        mockQueryRunner,
      );

      // 2. G2: Auto-end previous primary HEAD
      expect(mockManagersRepo.endPreviousPrimaryHead).toHaveBeenCalledWith(
        'u-1',
        '2026-09-01',
        'actor-admin',
        mockQueryRunner,
      );

      // 3. Manager inserted
      expect(mockManagersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgUnitId: 'u-1',
          userId: dto.userId,
          managerRoleCode: ORG_MANAGER_ROLES.HEAD,
          isPrimary: true,
        }),
        'actor-admin',
        mockQueryRunner,
      );

      // 4. G6: HeadUserId refreshed on OrgUnits
      expect(mockUnitsRepo.updateHeadUser).toHaveBeenCalledWith(
        'u-1',
        dto.userId,
        'actor-admin',
        mockQueryRunner,
      );

      // 5. Change log and Audit emitted
      expect(mockChangeLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ changeType: 'MANAGER_ASSIGNED' }),
        mockQueryRunner,
      );
      expect(mockAuditService.logOrgUnitChange).toHaveBeenCalled();

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(res.userId).toBe(dto.userId);
    });

    it('assigning non-primary DEPUTY does not end previous head or update HeadUserId', async () => {
      const dto = {
        userId: 'deputy-user-id',
        managerRoleCode: ORG_MANAGER_ROLES.DEPUTY,
        isPrimary: false,
        effectiveFrom: '2026-09-01',
      };

      await service.assignManager('u-1', dto, 'actor-admin');

      expect(mockManagersRepo.endPreviousPrimaryHead).not.toHaveBeenCalled();
      expect(mockUnitsRepo.updateHeadUser).not.toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('updateManager', () => {
    it('promoting manager to primary HEAD auto-ends previous HEAD (G2) and refreshes HeadUserId (G6)', async () => {
      const existingDeputy = {
        ...sampleManager,
        managerRoleCode: ORG_MANAGER_ROLES.HEAD,
        isPrimary: false,
      };
      mockManagersRepo.findById.mockResolvedValue(existingDeputy);

      await service.updateManager(
        sampleManager.orgUnitManagerId,
        { isPrimary: true },
        'actor-admin',
      );

      expect(mockManagersRepo.endPreviousPrimaryHead).toHaveBeenCalled();
      expect(mockUnitsRepo.updateHeadUser).toHaveBeenCalledWith(
        sampleManager.orgUnitId,
        sampleManager.userId,
        'actor-admin',
        mockQueryRunner,
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('removeManager', () => {
    it('removing primary manager soft deletes assignment and clears HeadUserId', async () => {
      mockManagersRepo.findById.mockResolvedValue(sampleManager);
      mockManagersRepo.findCurrentHead.mockResolvedValue(null);

      await service.removeManager(
        sampleManager.orgUnitManagerId,
        'actor-admin',
      );

      expect(mockManagersRepo.softDelete).toHaveBeenCalledWith(
        sampleManager.orgUnitManagerId,
        'actor-admin',
        mockQueryRunner,
      );
      expect(mockUnitsRepo.updateHeadUser).toHaveBeenCalledWith(
        sampleManager.orgUnitId,
        null,
        'actor-admin',
        mockQueryRunner,
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('getApprovalChain (§8.4 / Rule G7)', () => {
    it('returns hierarchical approval chain resolved through OrgUnitManagers with effective dates', async () => {
      const chain = await service.getApprovalChain('u-1');
      expect(chain).toHaveLength(2);
      expect(chain[0].step).toBe(1);
      expect(chain[0].head.userId).toBe('user-ops');
      expect(chain[1].step).toBe(2);
      expect(chain[1].head.userId).toBe('user-it');
    });
  });
});
