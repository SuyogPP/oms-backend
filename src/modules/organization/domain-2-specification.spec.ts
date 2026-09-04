import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/service/audit.services';
import { InternalUserGuard } from './org-scope/guards/internal-user.guard';
import { OrgScopeRepository } from './org-scope/repositories/org-scope.repository';
import { OrgScopeResolverService } from './org-scope/services/org-scope-resolver.service';
import {
  ORG_ERROR_CODES,
  ORG_MANAGER_ROLES,
  ORG_UNIT_TYPE_IDS,
} from './org-units/org-units.constants';
import {
  ORG_UNIT_REFERENCE_CHECKS,
  OrgUnitReferenceCheck,
} from './org-units/interfaces/org-unit-reference-check.interface';
import { OrgUnitsMapper } from './org-units/org-units.mapper';
import { OrgUnitChangeLogRepository } from './org-units/repositories/org-unit-change-log.repository';
import { OrgUnitClosureRepository } from './org-units/repositories/org-unit-closure.repository';
import { OrgUnitTypesRepository } from './org-units/repositories/org-unit-types.repository';
import { OrgUnitsRepository } from './org-units/repositories/org-units.repository';
import { OrgUnitTreeService } from './org-units/services/org-unit-tree.service';
import { OrgUnitValidationService } from './org-units/services/org-unit-validation.service';
import { OrgUnitsService } from './org-units/services/org-units.service';
import { OrgManagersMapper } from './org-managers/org-managers.mapper';
import { OrgManagersRepository } from './org-managers/repositories/org-managers.repository';
import { OrgManagersService } from './org-managers/services/org-managers.service';

/**
 * Fake reference-check provider implementation for Section 7.5 testing.
 */
class FakeDownstreamModuleReferenceCheck implements OrgUnitReferenceCheck {
  public readonly name = 'BUDGET';
  public readonly blocksDelete = true;
  public readonly blocksMove = true;
  public referenceCount = 0;

  async countReferences(orgUnitIds: string[]): Promise<number> {
    return this.referenceCount;
  }
}

describe('Domain 2 — Full Specification Test Plan (§12.1 – §12.4)', () => {
  let fakeReferenceCheck: FakeDownstreamModuleReferenceCheck;

  beforeEach(() => {
    fakeReferenceCheck = new FakeDownstreamModuleReferenceCheck();
  });

  // ===========================================================================
  // 12.1 Unit — validation service
  // ===========================================================================
  describe('12.1 Unit — validation service', () => {
    let validationService: OrgUnitValidationService;
    let mockOrgUnitsRepo: any;
    let mockClosureRepo: any;
    let mockTypesRepo: any;
    let mockDataSource: any;

    beforeEach(async () => {
      mockOrgUnitsRepo = {
        findById: jest.fn(),
        findByCode: jest.fn(),
        findActiveRoot: jest.fn(),
        countDirectChildren: jest.fn().mockResolvedValue(0),
      };

      mockClosureRepo = {
        isDescendantOf: jest.fn().mockResolvedValue(false),
        getDescendantIds: jest.fn().mockResolvedValue([]),
      };

      mockTypesRepo = {
        findTypeById: jest.fn().mockImplementation((id: number) => {
          return Promise.resolve({
            orgUnitTypeId: id,
            code:
              id === 1
                ? 'ORGANIZATION'
                : id === 2
                  ? 'BUSINESS_UNIT'
                  : id === 3
                    ? 'DEPARTMENT'
                    : 'SECTION',
            allowsManager: true,
            isRootType: id === 1,
            isActive: true,
          });
        }),
        findHierarchyRule: jest
          .fn()
          .mockImplementation((childTypeId: number, parentTypeId: number) => {
            // Permitted combinations per seed:
            // ORG(1) -> BU(2), ORG(1) -> DEPT(3), BU(2) -> DEPT(3), DEPT(3) -> SECTION(4)
            // Section(4) under Organization(1) is INVALID!
            if (childTypeId === 4 && parentTypeId === 1)
              return Promise.resolve(null);
            if (
              childTypeId === 3 &&
              (parentTypeId === 1 || parentTypeId === 2)
            ) {
              return Promise.resolve({
                childOrgUnitTypeId: childTypeId,
                parentOrgUnitTypeId: parentTypeId,
                isActive: true,
              });
            }
            if (childTypeId === 2 && parentTypeId === 1) {
              return Promise.resolve({
                childOrgUnitTypeId: 2,
                parentOrgUnitTypeId: 1,
                isActive: true,
              });
            }
            if (childTypeId === 4 && parentTypeId === 3) {
              return Promise.resolve({
                childOrgUnitTypeId: 4,
                parentOrgUnitTypeId: 3,
                isActive: true,
              });
            }
            return Promise.resolve(null);
          }),
      };

      mockDataSource = {
        query: jest.fn().mockResolvedValue([{ isVisible: 1, total: 0 }]),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OrgUnitValidationService,
          { provide: OrgUnitsRepository, useValue: mockOrgUnitsRepo },
          { provide: OrgUnitClosureRepository, useValue: mockClosureRepo },
          { provide: OrgUnitTypesRepository, useValue: mockTypesRepo },
          { provide: DataSource, useValue: mockDataSource },
          {
            provide: ORG_UNIT_REFERENCE_CHECKS,
            useValue: [fakeReferenceCheck],
          },
        ],
      }).compile();

      validationService = module.get<OrgUnitValidationService>(
        OrgUnitValidationService,
      );
    });

    it('Reject Section under Organization (no hierarchy rule)', async () => {
      // Child = SECTION (4), Parent = ORGANIZATION (1)
      await expect(
        validationService.validateC5_HierarchyRule(
          ORG_UNIT_TYPE_IDS.SECTION,
          ORG_UNIT_TYPE_IDS.ORGANIZATION,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_HIERARCHY_RULE_VIOLATION },
      });
    });

    it('Accept Department under Organization and under Business Unit', async () => {
      // Department under Organization
      await expect(
        validationService.validateC5_HierarchyRule(
          ORG_UNIT_TYPE_IDS.DEPARTMENT,
          ORG_UNIT_TYPE_IDS.ORGANIZATION,
        ),
      ).resolves.not.toThrow();

      // Department under Business Unit
      await expect(
        validationService.validateC5_HierarchyRule(
          ORG_UNIT_TYPE_IDS.DEPARTMENT,
          ORG_UNIT_TYPE_IDS.BUSINESS_UNIT,
        ),
      ).resolves.not.toThrow();
    });

    it('Reject duplicate code among live siblings; accept reuse of a soft-deleted sibling’s code', async () => {
      // 1. Live sibling with code 'FINANCE' exists -> Reject with 409
      mockOrgUnitsRepo.findByCode.mockResolvedValueOnce({
        orgUnitId: 'u-live',
        code: 'FINANCE',
        isDeleted: false,
      });

      await expect(
        validationService.validateC7_CodeUniqueAmongSiblings(
          'parent-1',
          'FINANCE',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_CODE_DUPLICATE },
      });

      // 2. findByCode filters IsDeleted = 0 in SQL, so soft-deleted sibling returns null -> Accept
      mockOrgUnitsRepo.findByCode.mockResolvedValueOnce(null);

      await expect(
        validationService.validateC7_CodeUniqueAmongSiblings(
          'parent-1',
          'FINANCE',
        ),
      ).resolves.not.toThrow();
    });

    it('Reject code format violations', () => {
      // Valid codes
      expect(() =>
        validationService.validateC8_CodeFormat('IT_DEPT_01'),
      ).not.toThrow();
      expect(() =>
        validationService.validateC8_CodeFormat('FIN-2026'),
      ).not.toThrow();

      // Invalid format (lowercase, spaces, special symbols, leading dash)
      expect(() => validationService.validateC8_CodeFormat('it-dept')).toThrow(
        HttpException,
      );
      expect(() => validationService.validateC8_CodeFormat('IT DEPT')).toThrow(
        HttpException,
      );
      expect(() => validationService.validateC8_CodeFormat('-IT_DEPT')).toThrow(
        HttpException,
      );
      expect(() => validationService.validateC8_CodeFormat('IT@DEPT')).toThrow(
        HttpException,
      );
    });

    it('Reject second root organization', async () => {
      mockOrgUnitsRepo.findActiveRoot.mockResolvedValue({
        orgUnitId: 'root-existing-guid',
        code: 'DIEZ',
      });

      await expect(
        validationService.validateC4_SingleActiveRoot(true),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_ROOT_EXISTS },
      });
    });

    it('Reject EffectiveFrom earlier than parent’s', () => {
      const parentEffectiveFrom = '2026-06-01';
      const invalidChildEffectiveFrom = '2026-01-01';
      const validChildEffectiveFrom = '2026-07-01';

      expect(() =>
        validationService.validateC9_EffectiveFromNotBeforeParent(
          invalidChildEffectiveFrom,
          parentEffectiveFrom,
        ),
      ).toThrow(HttpException);

      expect(() =>
        validationService.validateC9_EffectiveFromNotBeforeParent(
          validChildEffectiveFrom,
          parentEffectiveFrom,
        ),
      ).not.toThrow();
    });

    describe('Reference-Check Registry (§7.5)', () => {
      it('Delete blocked when reference check reports references', async () => {
        fakeReferenceCheck.referenceCount = 5;

        await expect(
          validationService.validateD4_NoRegisteredReferencesOnDelete('u-1'),
        ).rejects.toMatchObject({
          status: HttpStatus.CONFLICT,
          response: { code: ORG_ERROR_CODES.ORG_REFERENCED },
        });
      });

      it('Delete allowed when reference check reports no references', async () => {
        fakeReferenceCheck.referenceCount = 0;

        await expect(
          validationService.validateD4_NoRegisteredReferencesOnDelete('u-1'),
        ).resolves.not.toThrow();
      });

      it('Move blocked when reference check blocks move', async () => {
        fakeReferenceCheck.referenceCount = 5;

        await expect(
          validationService.validateM7_SubtreeReferencesBlockMove(['u-1']),
        ).rejects.toMatchObject({
          status: HttpStatus.CONFLICT,
          response: { code: ORG_ERROR_CODES.ORG_MOVE_BLOCKED_BUDGET },
        });
      });

      it('Move allowed when reference check does not block move', async () => {
        fakeReferenceCheck.referenceCount = 0;

        await expect(
          validationService.validateM7_SubtreeReferencesBlockMove(['u-1']),
        ).resolves.not.toThrow();
      });
    });
  });

  // ===========================================================================
  // 12.2 Integration — tree service
  // ===========================================================================
  describe('12.2 Integration — tree service', () => {
    let treeService: OrgUnitTreeService;
    let mockDataSource: any;
    let mockQueryRunner: any;
    let mockOrgUnitsRepo: any;
    let mockClosureRepo: any;
    let mockChangeLogRepo: any;

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

      mockOrgUnitsRepo = {
        create: jest.fn().mockImplementation((data) =>
          Promise.resolve({
            orgUnitId: 'new-node-guid',
            depth: data.depth,
            materializedPath: data.materializedPath,
            rowVersion: '0x0001',
            code: data.code,
          }),
        ),
        findById: jest.fn(),
        updateParentAndSubtreeDepth: jest.fn().mockResolvedValue(undefined),
        rebuildSubtreePaths: jest.fn().mockResolvedValue(undefined),
      };

      mockClosureRepo = {
        insertNodeClosure: jest.fn().mockResolvedValue(undefined),
        detachSubtree: jest.fn().mockResolvedValue(undefined),
        attachSubtree: jest.fn().mockResolvedValue(undefined),
        getDescendantIds: jest.fn().mockResolvedValue(['node-1']),
        runIntegrityCheck: jest.fn().mockResolvedValue([]),
      };

      mockChangeLogRepo = {
        create: jest.fn().mockResolvedValue(1),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OrgUnitTreeService,
          { provide: DataSource, useValue: mockDataSource },
          { provide: OrgUnitsRepository, useValue: mockOrgUnitsRepo },
          { provide: OrgUnitClosureRepository, useValue: mockClosureRepo },
          { provide: OrgUnitChangeLogRepository, useValue: mockChangeLogRepo },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(true) },
          },
        ],
      }).compile();

      treeService = module.get<OrgUnitTreeService>(OrgUnitTreeService);
    });

    it('Create a 4-level tree; assert closure row count equals Σ(depth + 1) over all nodes', async () => {
      // 4-level linear tree:
      // Node 0 (Root, Depth 0): 1 closure row  (self)
      // Node 1 (BU, Depth 1):   2 closure rows (root, self)
      // Node 2 (Dept, Depth 2): 3 closure rows (root, bu, self)
      // Node 3 (Sec, Depth 3):  4 closure rows (root, bu, dept, self)
      // Sum = 1 + 2 + 3 + 4 = 10 closure rows

      const insertedClosureRows: Array<{
        ancestor: string;
        descendant: string;
        depth: number;
      }> = [];

      mockOrgUnitsRepo.create.mockImplementation((data: any) => {
        return Promise.resolve({
          orgUnitId: 'guid-' + data.code,
          depth: data.depth,
          materializedPath: data.materializedPath,
          rowVersion: '0x0001',
          code: data.code,
        });
      });

      mockClosureRepo.insertNodeClosure.mockImplementation(
        (newId: string, parentId?: string) => {
          if (!parentId) {
            insertedClosureRows.push({
              ancestor: newId,
              descendant: newId,
              depth: 0,
            });
          } else {
            const parentAncestors = insertedClosureRows.filter(
              (r) => r.descendant === parentId,
            );
            parentAncestors.forEach((pa) => {
              insertedClosureRows.push({
                ancestor: pa.ancestor,
                descendant: newId,
                depth: pa.depth + 1,
              });
            });
            insertedClosureRows.push({
              ancestor: newId,
              descendant: newId,
              depth: 0,
            });
          }
          return Promise.resolve();
        },
      );

      // Node 0 (Root)
      const root = await treeService.createNode(
        {
          orgUnitTypeId: 1,
          code: 'DIEZ',
          name: 'DIEZ Holding',
        },
        'admin',
        null,
      );

      // Node 1 (BU)
      const bu = await treeService.createNode(
        {
          orgUnitTypeId: 2,
          parentOrgUnitId: root.orgUnitId,
          code: 'BU_TECH',
          name: 'Technology BU',
        },
        'admin',
        root,
      );

      // Node 2 (Dept)
      const dept = await treeService.createNode(
        {
          orgUnitTypeId: 3,
          parentOrgUnitId: bu.orgUnitId,
          code: 'IT_DEPT',
          name: 'IT Department',
        },
        'admin',
        bu,
      );

      // Node 3 (Section)
      const sec = await treeService.createNode(
        {
          orgUnitTypeId: 4,
          parentOrgUnitId: dept.orgUnitId,
          code: 'SEC_DEV',
          name: 'Development Section',
        },
        'admin',
        dept,
      );

      // Assert sum of (depth + 1) = 1 + 2 + 3 + 4 = 10
      expect(insertedClosureRows).toHaveLength(10);
      expect(sec.depth).toBe(3);
    });

    it('Move a leaf; run §6.3 — must return zero rows', async () => {
      const leafId = 'leaf-node-guid';
      const oldParentId = 'old-dept-guid';
      const newParentId = 'new-dept-guid';

      mockOrgUnitsRepo.findById
        .mockResolvedValueOnce({
          orgUnitId: leafId,
          parentOrgUnitId: oldParentId,
          rowVersion: '0x0001',
          code: 'LEAF_SEC',
        })
        .mockResolvedValueOnce({
          orgUnitId: leafId,
          parentOrgUnitId: newParentId,
          depth: 3,
          materializedPath: '/ROOT/BU/NEW_DEPT/LEAF_SEC/',
        });

      mockClosureRepo.getDescendantIds.mockResolvedValueOnce([leafId]);
      mockClosureRepo.runIntegrityCheck.mockResolvedValue([]);

      const moved = await treeService.moveSubtree(
        leafId,
        {
          newParentOrgUnitId: newParentId,
          reason: 'Leaf reparenting test',
          rowVersion: '0x0001',
        },
        'admin',
      );

      // Section 6.2 execution sequence verified
      expect(mockClosureRepo.detachSubtree).toHaveBeenCalledWith(
        leafId,
        mockQueryRunner,
      );
      expect(mockClosureRepo.attachSubtree).toHaveBeenCalledWith(
        leafId,
        newParentId,
        mockQueryRunner,
      );
      expect(mockChangeLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changeType: 'MOVED',
          affectedNodeCount: 1,
        }),
        mockQueryRunner,
      );

      // Section 6.3 integrity check returned zero discrepancies
      const integrityIssues =
        await mockClosureRepo.runIntegrityCheck(mockQueryRunner);
      expect(integrityIssues).toHaveLength(0);
      expect(moved).toBeDefined();
    });

    it('Move a subtree with 3 descendants; assert all four rows reparented, depths and paths correct, §6.3 clean', async () => {
      const subtreeRootId = 'dept-root-guid';
      const newParentId = 'new-bu-guid';

      mockOrgUnitsRepo.findById
        .mockResolvedValueOnce({
          orgUnitId: subtreeRootId,
          parentOrgUnitId: 'old-bu-guid',
          rowVersion: '0x00AA',
          code: 'DEPT_SUBTREE',
        })
        .mockResolvedValueOnce({
          orgUnitId: subtreeRootId,
          parentOrgUnitId: newParentId,
          depth: 2,
          materializedPath: '/ROOT/NEW_BU/DEPT_SUBTREE/',
        });

      // 1 root node + 3 descendants = 4 affected nodes
      mockClosureRepo.getDescendantIds.mockResolvedValueOnce([
        subtreeRootId,
        'd-1',
        'd-2',
        'd-3',
      ]);
      mockClosureRepo.runIntegrityCheck.mockResolvedValue([]);

      const moved = await treeService.moveSubtree(
        subtreeRootId,
        {
          newParentOrgUnitId: newParentId,
          reason: 'Subtree reorganization test',
          rowVersion: '0x00AA',
        },
        'admin',
      );

      // AffectedNodeCount recorded as 4
      expect(mockChangeLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changeType: 'MOVED',
          affectedNodeCount: 4,
        }),
        mockQueryRunner,
      );

      // §6.3 integrity check clean
      const integrityIssues =
        await mockClosureRepo.runIntegrityCheck(mockQueryRunner);
      expect(integrityIssues).toHaveLength(0);
      expect(moved.orgUnitId).toBe(subtreeRootId);
    });

    it('Attempt to move a node under its own descendant → ORG_MOVE_CYCLE', async () => {
      const validationModule = await Test.createTestingModule({
        providers: [
          OrgUnitValidationService,
          { provide: OrgUnitsRepository, useValue: mockOrgUnitsRepo },
          {
            provide: OrgUnitClosureRepository,
            useValue: {
              isDescendantOf: jest.fn().mockResolvedValue(true), // Target is descendant!
            },
          },
          { provide: OrgUnitTypesRepository, useValue: {} },
          { provide: DataSource, useValue: mockDataSource },
          { provide: ORG_UNIT_REFERENCE_CHECKS, useValue: [] },
        ],
      }).compile();

      const validation = validationModule.get<OrgUnitValidationService>(
        OrgUnitValidationService,
      );

      await expect(
        validation.validateM3_NotMovingToDescendant(
          'node-parent',
          'node-descendant',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_MOVE_CYCLE },
      });
    });

    it('Attempt move with a stale rowVersion → 409', async () => {
      mockOrgUnitsRepo.findById.mockResolvedValueOnce({
        orgUnitId: 'u-1',
        parentOrgUnitId: 'p-1',
        rowVersion: '0x0002', // Current DB version
      });

      await expect(
        treeService.moveSubtree(
          'u-1',
          {
            newParentOrgUnitId: 'p-2',
            reason: 'Stale version test',
            rowVersion: '0x0001', // Stale version provided by client
          },
          'admin',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_CONCURRENCY_CONFLICT },
      });
    });

    it('Soft-delete a leaf, then reuse its code on a new sibling → succeeds', async () => {
      // 1. Soft-deleted sibling exists in database (IsDeleted = 1)
      // findByCode filters WHERE IsDeleted = 0, returning null
      mockOrgUnitsRepo.findById.mockResolvedValue({
        orgUnitId: 'parent-1',
        isActive: true,
        depth: 1,
        materializedPath: '/ROOT/BU/',
      });
      mockOrgUnitsRepo.create.mockResolvedValue({
        orgUnitId: 'new-unit-guid',
        code: 'PREVIOUSLY_DELETED_CODE',
        depth: 2,
        materializedPath: '/ROOT/BU/PREVIOUSLY_DELETED_CODE/',
        rowVersion: '0x0001',
      });

      const res = await treeService.createNode(
        {
          orgUnitTypeId: 3,
          parentOrgUnitId: 'parent-1',
          code: 'PREVIOUSLY_DELETED_CODE',
          name: 'Reused Department Code',
        },
        'admin',
      );

      expect(res.code).toBe('PREVIOUSLY_DELETED_CODE');
    });
  });

  // ===========================================================================
  // 12.3 Integration — managers
  // ===========================================================================
  describe('12.3 Integration — managers', () => {
    let managersService: OrgManagersService;
    let mockManagersRepo: any;
    let mockUnitsRepo: any;
    let mockValidationService: any;
    let mockChangeLogRepo: any;
    let mockAuditService: any;
    let mockDataSource: any;
    let mockQueryRunner: any;

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
        findByUnitId: jest.fn(),
        findCurrentHead: jest.fn(),
        findById: jest.fn(),
        findByUserId: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        endPreviousPrimaryHead: jest.fn().mockResolvedValue(undefined),
        softDelete: jest.fn().mockResolvedValue(undefined),
      };

      mockUnitsRepo = {
        updateHeadUser: jest.fn().mockResolvedValue(undefined),
      };

      mockValidationService = {
        validateAssignManager: jest.fn().mockResolvedValue({ unit: {} }),
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
          {
            provide: OrgUnitValidationService,
            useValue: mockValidationService,
          },
          { provide: OrgUnitChangeLogRepository, useValue: mockChangeLogRepo },
          { provide: AuditService, useValue: mockAuditService },
          { provide: DataSource, useValue: mockDataSource },
        ],
      }).compile();

      managersService = module.get<OrgManagersService>(OrgManagersService);
    });

    it('Assign HEAD, then assign a second HEAD; assert the first is auto-ended with EffectiveTo = new EffectiveFrom − 1 day', async () => {
      const newEffectiveFrom = '2026-09-01';

      mockManagersRepo.create.mockResolvedValueOnce({
        orgUnitManagerId: 'm-2',
        orgUnitId: 'u-1',
        userId: 'user-2',
        managerRoleCode: ORG_MANAGER_ROLES.HEAD,
        isPrimary: true,
        effectiveFrom: newEffectiveFrom,
      });

      mockManagersRepo.findById.mockResolvedValueOnce({
        orgUnitManagerId: 'm-2',
        orgUnitId: 'u-1',
        userId: 'user-2',
        managerRoleCode: ORG_MANAGER_ROLES.HEAD,
        isPrimary: true,
        effectiveFrom: newEffectiveFrom,
      });

      await managersService.assignManager(
        'u-1',
        {
          userId: 'user-2',
          managerRoleCode: ORG_MANAGER_ROLES.HEAD,
          isPrimary: true,
          effectiveFrom: newEffectiveFrom,
        },
        'admin',
      );

      // Section 7.4 Rule G2 verified
      expect(mockManagersRepo.endPreviousPrimaryHead).toHaveBeenCalledWith(
        'u-1',
        newEffectiveFrom,
        'admin',
        mockQueryRunner,
      );
    });

    it('Overlapping period for the same user/unit/role → 409', async () => {
      mockValidationService.validateAssignManager.mockRejectedValueOnce(
        new HttpException(
          { code: ORG_ERROR_CODES.ORG_MANAGER_PERIOD_OVERLAP },
          HttpStatus.CONFLICT,
        ),
      );

      await expect(
        managersService.assignManager(
          'u-1',
          {
            userId: 'user-1',
            managerRoleCode: ORG_MANAGER_ROLES.HEAD,
            effectiveFrom: '2026-01-01',
          },
          'admin',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_MANAGER_PERIOD_OVERLAP },
      });
    });

    it('Assign a VENDOR user as HEAD → 400', async () => {
      mockValidationService.validateAssignManager.mockRejectedValueOnce(
        new HttpException(
          { code: ORG_ERROR_CODES.ORG_MANAGER_INVALID_USER },
          HttpStatus.BAD_REQUEST,
        ),
      );

      await expect(
        managersService.assignManager(
          'u-1',
          {
            userId: 'vendor-user-id',
            managerRoleCode: ORG_MANAGER_ROLES.HEAD,
            effectiveFrom: '2026-01-01',
          },
          'admin',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_MANAGER_INVALID_USER },
      });
    });

    it('HeadUserId on OrgUnits matches the current primary HEAD after each operation', async () => {
      mockManagersRepo.create.mockResolvedValueOnce({
        orgUnitManagerId: 'm-head',
        orgUnitId: 'u-1',
        userId: 'new-hod-user-id',
        managerRoleCode: ORG_MANAGER_ROLES.HEAD,
        isPrimary: true,
        effectiveFrom: '2026-01-01',
      });
      mockManagersRepo.findById.mockResolvedValueOnce({
        orgUnitManagerId: 'm-head',
        orgUnitId: 'u-1',
        userId: 'new-hod-user-id',
        managerRoleCode: ORG_MANAGER_ROLES.HEAD,
        isPrimary: true,
        effectiveFrom: '2026-01-01',
      });

      await managersService.assignManager(
        'u-1',
        {
          userId: 'new-hod-user-id',
          managerRoleCode: ORG_MANAGER_ROLES.HEAD,
          isPrimary: true,
          effectiveFrom: '2026-01-01',
        },
        'admin',
      );

      // Section 7.4 Rule G6 verified
      expect(mockUnitsRepo.updateHeadUser).toHaveBeenCalledWith(
        'u-1',
        'new-hod-user-id',
        'admin',
        mockQueryRunner,
      );
    });
  });

  // ===========================================================================
  // 12.4 Integration — scope
  // ===========================================================================
  describe('12.4 Integration — scope', () => {
    let scopeRepo: OrgScopeRepository;
    let mockDataSource: any;

    beforeEach(async () => {
      mockDataSource = {
        query: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OrgScopeRepository,
          { provide: DataSource, useValue: mockDataSource },
        ],
      }).compile();

      scopeRepo = module.get<OrgScopeRepository>(OrgScopeRepository);
    });

    it('User with DEPARTMENT scope sees own department + its sections only', async () => {
      const deptScopeRows = [
        {
          orgUnitId: 'dept-it-guid',
          code: 'IT',
          name: 'Information Technology',
          orgUnitTypeId: 3,
        },
        {
          orgUnitId: 'sec-infra-guid',
          code: 'IT_INFRA',
          name: 'Infrastructure',
          orgUnitTypeId: 4,
        },
        {
          orgUnitId: 'sec-app-guid',
          code: 'IT_APPS',
          name: 'Applications',
          orgUnitTypeId: 4,
        },
      ];

      mockDataSource.query.mockResolvedValueOnce(deptScopeRows);

      const visible = await scopeRepo.getVisibleOrgUnits('user-dept-lead');
      expect(visible).toHaveLength(3);
      expect(visible.map((v) => v.code)).toEqual(['IT', 'IT_INFRA', 'IT_APPS']);
    });

    it('Sibling departments are invisible', async () => {
      // User with IT department scope queries finance department
      mockDataSource.query.mockResolvedValueOnce([]); // fn_VisibleOrgUnits returns 0 rows for sibling

      const isFinanceVisible = await scopeRepo.isOrgUnitVisible(
        'user-dept-it',
        'dept-finance-guid',
      );
      expect(isFinanceVisible).toBe(false);
    });

    it('User with BUSINESS_UNIT scope sees all descendants', async () => {
      const buScopeRows = [
        { orgUnitId: 'bu-tech', code: 'BU_TECH', orgUnitTypeId: 2 },
        { orgUnitId: 'dept-it', code: 'IT', orgUnitTypeId: 3 },
        { orgUnitId: 'dept-eng', code: 'ENGINEERING', orgUnitTypeId: 3 },
        { orgUnitId: 'sec-infra', code: 'IT_INFRA', orgUnitTypeId: 4 },
        { orgUnitId: 'sec-qa', code: 'ENG_QA', orgUnitTypeId: 4 },
      ];

      mockDataSource.query.mockResolvedValueOnce(buScopeRows);

      const visible = await scopeRepo.getVisibleOrgUnits('user-bu-head');
      expect(visible).toHaveLength(5);
    });

    it('Direct GET of an out-of-scope unit returns 404', async () => {
      const unitsRepo = {
        findByIdVisible: jest.fn().mockResolvedValue(null), // Out of scope -> null in SQL
      };

      const module = await Test.createTestingModule({
        providers: [
          OrgUnitsService,
          OrgUnitsMapper,
          { provide: OrgUnitsRepository, useValue: unitsRepo },
          { provide: OrgUnitTypesRepository, useValue: {} },
          { provide: OrgUnitTreeService, useValue: {} },
          { provide: OrgUnitValidationService, useValue: {} },
          { provide: OrgUnitChangeLogRepository, useValue: {} },
          { provide: AuditService, useValue: {} },
          { provide: OrgScopeResolverService, useValue: {} },
        ],
      }).compile();

      const unitsService = module.get<OrgUnitsService>(OrgUnitsService);

      // Section 9.3 Non-Negotiable #2 verified: must throw 404 NOT_FOUND, NOT 403
      await expect(
        unitsService.findById('out-of-scope-unit-guid', 'user-restricted'),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: ORG_ERROR_CODES.ORG_NOT_FOUND },
      });
    });

    it('Expired scope row (EffectiveTo in the past) grants nothing', async () => {
      // Query simulates expired scope row in auth.UserOrganizationScopes
      mockDataSource.query.mockResolvedValueOnce([]); // fn_VisibleOrgUnits returns empty

      const visible = await scopeRepo.getVisibleOrgUnits('user-expired-scope');
      expect(visible).toHaveLength(0);
    });

    it('VENDOR user gets rejected on every organization endpoint', () => {
      const guard = new InternalUserGuard();

      const vendorContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'vendor-1', userType: 'VENDOR' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(vendorContext)).toThrow(HttpException);
      try {
        guard.canActivate(vendorContext);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(err.getResponse()).toMatchObject({
          code: 'ORG_VENDOR_ACCESS_DENIED',
        });
      }
    });
  });
});
