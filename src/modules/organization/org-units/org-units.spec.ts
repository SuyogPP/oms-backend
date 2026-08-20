import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../audit/service/audit.services';
import { ORG_ERROR_CODES } from './org-units.constants';
import { OrgUnitsMapper } from './org-units.mapper';
import { OrgUnitChangeLogRepository } from './repositories/org-unit-change-log.repository';
import { OrgUnitTypesRepository } from './repositories/org-unit-types.repository';
import { OrgUnitsRepository } from './repositories/org-units.repository';
import { OrgScopeResolverService } from '../org-scope/services/org-scope-resolver.service';
import { OrgUnitTreeService } from './services/org-unit-tree.service';
import { OrgUnitTypesService } from './services/org-unit-types.service';
import { OrgUnitValidationService } from './services/org-unit-validation.service';
import { OrgUnitsService } from './services/org-units.service';

describe('OrgUnitsService & OrgUnitTypesService', () => {
  let unitsService: OrgUnitsService;
  let typesService: OrgUnitTypesService;
  let mockUnitsRepo: any;
  let mockTypesRepo: any;
  let mockTreeService: any;
  let mockValidationService: any;
  let mockChangeLogRepo: any;
  let mockAuditService: any;
  let mockScopeResolver: any;

  const sampleUnitType = {
    orgUnitTypeId: 3,
    code: 'DEPARTMENT',
    name: 'Department',
    canonicalLevel: 3,
    scopeLevelCode: 'DEPARTMENT',
    allowsBudget: true,
    allowsRequisition: true,
    allowsManager: true,
    isRootType: false,
    sortOrder: 30,
    isActive: true,
  };

  const sampleUnit = {
    orgUnitId: '33333333-4444-5555-6666-777777777777',
    orgUnitTypeId: 3,
    parentOrgUnitId: '22222222-3333-4444-5555-666666666666',
    code: 'IT',
    name: 'Information Technology',
    depth: 2,
    materializedPath: '/11111111222233334444555555555555/22222222333344445555666666666666/33333333444455556666777777777777/',
    sortOrder: 10,
    effectiveFrom: '2026-01-01',
    isActive: true,
    rowVersion: '0x00000000000007D1',
  };

  beforeEach(async () => {
    mockUnitsRepo = {
      findAllVisible: jest.fn().mockResolvedValue([[sampleUnit], 1]),
      findVisibleTree: jest.fn().mockResolvedValue([sampleUnit]),
      findById: jest.fn().mockResolvedValue(sampleUnit),
      findByIdVisible: jest.fn().mockResolvedValue(sampleUnit),
      findChildren: jest.fn().mockResolvedValue([]),
      findChildrenVisible: jest.fn().mockResolvedValue([]),
      findAncestors: jest.fn().mockResolvedValue([]),
      findAncestorsVisible: jest.fn().mockResolvedValue([]),
      findDescendants: jest.fn().mockResolvedValue([]),
      findDescendantsVisible: jest.fn().mockResolvedValue([]),
      countDirectChildren: jest.fn().mockResolvedValue(2),
      countSubtreeDescendants: jest.fn().mockResolvedValue(5),
      countForExport: jest.fn().mockResolvedValue(1),
      findForExport: jest.fn().mockResolvedValue([
        {
          orgUnitId: sampleUnit.orgUnitId,
          code: sampleUnit.code,
          name: sampleUnit.name,
          nameAr: null,
          typeName: 'Department',
          typeCode: 'DEPARTMENT',
          parentCode: 'BU_CORP',
          parentName: 'Corporate Services',
          depth: 2,
          costCenterCode: 'CC-100',
          headDisplayName: 'John Doe',
          isActive: true,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
      ]),
      update: jest.fn().mockResolvedValue(sampleUnit),
      setActiveStatus: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue(undefined),
      findBudgetOwner: jest.fn().mockResolvedValue(sampleUnit),
    };

    mockTypesRepo = {
      findAllTypes: jest.fn().mockResolvedValue([sampleUnitType]),
      findTypeById: jest.fn().mockResolvedValue(sampleUnitType),
      findAllHierarchyRules: jest.fn().mockResolvedValue([
        { childOrgUnitTypeId: 3, parentOrgUnitTypeId: 2, isActive: true },
      ]),
      findAllowedParentTypes: jest.fn().mockResolvedValue([
        { orgUnitTypeId: 2, code: 'BUSINESS_UNIT', name: 'Business Unit' },
      ]),
    };

    mockTreeService = {
      createNode: jest.fn().mockResolvedValue(sampleUnit),
      moveSubtree: jest.fn().mockResolvedValue(sampleUnit),
    };

    mockValidationService = {
      validateCreate: jest.fn().mockResolvedValue({ parentUnit: null }),
      validateMove: jest.fn().mockResolvedValue({}),
      validateDeactivate: jest.fn().mockResolvedValue(sampleUnit),
      validateDelete: jest.fn().mockResolvedValue(sampleUnit),
      validateC8_CodeFormat: jest.fn(),
      validateC7_CodeUniqueAmongSiblings: jest.fn(),
    };

    mockChangeLogRepo = {
      create: jest.fn().mockResolvedValue(1),
      findByOrgUnitId: jest.fn().mockResolvedValue([[ { orgUnitChangeLogId: 1 } ], 1]),
    };

    mockAuditService = {
      logOrgUnitChange: jest.fn().mockResolvedValue(undefined),
    };

    mockScopeResolver = {
      getVisibleOrgUnits: jest.fn().mockResolvedValue([sampleUnit]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgUnitsService,
        OrgUnitTypesService,
        OrgUnitsMapper,
        { provide: OrgUnitsRepository, useValue: mockUnitsRepo },
        { provide: OrgUnitTypesRepository, useValue: mockTypesRepo },
        { provide: OrgUnitTreeService, useValue: mockTreeService },
        { provide: OrgUnitValidationService, useValue: mockValidationService },
        { provide: OrgUnitChangeLogRepository, useValue: mockChangeLogRepo },
        { provide: AuditService, useValue: mockAuditService },
        { provide: OrgScopeResolverService, useValue: mockScopeResolver },
      ],
    }).compile();

    unitsService = module.get<OrgUnitsService>(OrgUnitsService);
    typesService = module.get<OrgUnitTypesService>(OrgUnitTypesService);
  });

  describe('OrgUnitsService', () => {
    it('findAll returns paginated list of units', async () => {
      const res = await unitsService.findAll({ page: 1, pageSize: 10 }, 'user-1');
      expect(res.data).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.data[0].code).toBe('IT');
    });

    it('findById returns detail entity with child count and descendant count', async () => {
      const res = await unitsService.findById(sampleUnit.orgUnitId, 'user-1');
      expect(res.orgUnitId).toBe(sampleUnit.orgUnitId);
      expect(res.childCount).toBe(2);
      expect(res.descendantCount).toBe(5);
      expect(mockUnitsRepo.findByIdVisible).toHaveBeenCalledWith(sampleUnit.orgUnitId, 'user-1');
    });

    it('findById throws 404 NOT_FOUND when unit is out of caller scope (Section 9.3 Non-Negotiable #2)', async () => {
      mockUnitsRepo.findByIdVisible.mockResolvedValue(null);

      await expect(
        unitsService.findById('out-of-scope-unit', 'user-restricted'),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: ORG_ERROR_CODES.ORG_NOT_FOUND },
      });
    });

    it('findChildren throws 404 NOT_FOUND when parent unit is out of caller scope', async () => {
      mockUnitsRepo.findByIdVisible.mockResolvedValue(null);

      await expect(
        unitsService.findChildren('out-of-scope-unit', 'user-restricted'),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: ORG_ERROR_CODES.ORG_NOT_FOUND },
      });
    });

    it('getMyVisibleUnits delegates to OrgScopeResolverService', async () => {
      const res = await unitsService.getMyVisibleUnits('user-1');
      expect(res).toHaveLength(1);
      expect(mockScopeResolver.getVisibleOrgUnits).toHaveBeenCalledWith('user-1');
    });

    it('create delegates to treeService.createNode and emits audit log', async () => {
      const dto = {
        orgUnitTypeId: 3,
        code: 'IT',
        name: 'Information Technology',
      };

      const res = await unitsService.create(dto, 'user-admin');

      expect(mockValidationService.validateCreate).toHaveBeenCalledWith(dto, 'user-admin');
      expect(mockTreeService.createNode).toHaveBeenCalled();
      expect(mockAuditService.logOrgUnitChange).toHaveBeenCalledWith(
        expect.objectContaining({ operationType: 'INSERT' }),
      );
      expect(res.orgUnitId).toBe(sampleUnit.orgUnitId);
    });

    it('update REJECTS parentOrgUnitId modification with 400', async () => {
      await expect(
        unitsService.update(
          sampleUnit.orgUnitId,
          { parentOrgUnitId: 'new-parent' } as any,
          'user-admin',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_PARENT_INVALID },
      });
    });

    it('update modifies attributes and emits change log + audit event', async () => {
      const dto = { name: 'Updated IT Dept' };
      await unitsService.update(sampleUnit.orgUnitId, dto, 'user-admin');

      expect(mockUnitsRepo.update).toHaveBeenCalledWith(
        sampleUnit.orgUnitId,
        expect.objectContaining({ name: 'Updated IT Dept', updatedBy: 'user-admin' }),
      );
      expect(mockChangeLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ changeType: 'UPDATED' }),
      );
      expect(mockAuditService.logOrgUnitChange).toHaveBeenCalledWith(
        expect.objectContaining({ operationType: 'UPDATE' }),
      );
    });

    it('move delegates to treeService.moveSubtree and emits audit event', async () => {
      const dto = {
        newParentOrgUnitId: '22222222-3333-4444-5555-666666666666',
        reason: 'Restructuring',
        rowVersion: '0x00000000000007D1',
      };

      await unitsService.move(sampleUnit.orgUnitId, dto, 'user-admin');

      expect(mockValidationService.validateMove).toHaveBeenCalledWith(
        sampleUnit.orgUnitId,
        dto,
        'user-admin',
      );
      expect(mockTreeService.moveSubtree).toHaveBeenCalledWith(
        sampleUnit.orgUnitId,
        dto,
        'user-admin',
      );
      expect(mockAuditService.logOrgUnitChange).toHaveBeenCalledWith(
        expect.objectContaining({ operationType: 'MOVE' }),
      );
    });

    it('activate sets isActive=true and emits audit event', async () => {
      await unitsService.activate(sampleUnit.orgUnitId, 'user-admin');
      expect(mockUnitsRepo.setActiveStatus).toHaveBeenCalledWith(
        sampleUnit.orgUnitId,
        true,
        null,
        'user-admin',
      );
      expect(mockAuditService.logOrgUnitChange).toHaveBeenCalled();
    });

    it('deactivate validates and sets isActive=false with effectiveTo', async () => {
      await unitsService.deactivate(sampleUnit.orgUnitId, 'user-admin');
      expect(mockValidationService.validateDeactivate).toHaveBeenCalledWith(sampleUnit.orgUnitId);
      expect(mockUnitsRepo.setActiveStatus).toHaveBeenCalled();
      expect(mockAuditService.logOrgUnitChange).toHaveBeenCalled();
    });

    it('softDelete validates and performs soft delete', async () => {
      await unitsService.softDelete(sampleUnit.orgUnitId, 'user-admin');
      expect(mockValidationService.validateDelete).toHaveBeenCalledWith(sampleUnit.orgUnitId);
      expect(mockUnitsRepo.softDelete).toHaveBeenCalledWith(sampleUnit.orgUnitId, 'user-admin');
      expect(mockAuditService.logOrgUnitChange).toHaveBeenCalledWith(
        expect.objectContaining({ operationType: 'SOFT_DELETE' }),
      );
    });

    it('exportToExcel generates Excel workbook synchronously for <= 5000 rows', async () => {
      const res = await unitsService.exportToExcel({}, 'user-admin');

      expect(res.queued).toBe(false);
      expect(res.buffer).toBeInstanceOf(Buffer);
      expect(res.filename).toMatch(/organization_units_export_.*\.xlsx/);
      expect(res.totalRows).toBe(1);
      expect(mockUnitsRepo.findForExport).toHaveBeenCalledWith('user-admin', {});
      expect(mockAuditService.logOrgUnitChange).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: 'EXPORT',
          changeCategory: 'DATA_EXPORT',
        }),
      );
    });

    it('exportToExcel queues background job for datasets exceeding 5000 rows', async () => {
      mockUnitsRepo.countForExport.mockResolvedValue(5420);

      const res = await unitsService.exportToExcel({}, 'user-admin');

      expect(res.queued).toBe(true);
      expect(res.jobId).toBeDefined();
      expect(res.totalRows).toBe(5420);
      expect(res.message).toContain('queued for background generation');
      expect(mockUnitsRepo.findForExport).not.toHaveBeenCalled();
      expect(mockAuditService.logOrgUnitChange).toHaveBeenCalledWith(
        expect.objectContaining({
          operationType: 'EXPORT',
          changeCategory: 'DATA_EXPORT',
        }),
      );
    });
  });

  describe('OrgUnitTypesService', () => {
    it('findAllTypes returns types with allowed child type IDs', async () => {
      const types = await typesService.findAllTypes();
      expect(types).toHaveLength(1);
      expect(types[0].code).toBe('DEPARTMENT');
    });

    it('findAllowedParents returns permitted parent types', async () => {
      const parents = await typesService.findAllowedParents(3);
      expect(parents).toHaveLength(1);
      expect(parents[0].code).toBe('BUSINESS_UNIT');
    });
  });
});
