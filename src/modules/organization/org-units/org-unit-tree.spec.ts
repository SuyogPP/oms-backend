import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ORG_ERROR_CODES } from './org-units.constants';
import { OrgUnitChangeLogRepository } from './repositories/org-unit-change-log.repository';
import { OrgUnitClosureRepository } from './repositories/org-unit-closure.repository';
import { OrgUnitsRepository } from './repositories/org-units.repository';
import { OrgUnitTreeService } from './services/org-unit-tree.service';

describe('OrgUnitTreeService (Domain 2 — Tree & Closure Maintenance)', () => {
  let service: OrgUnitTreeService;
  let mockDataSource: any;
  let mockOrgUnitsRepo: any;
  let mockClosureRepo: any;
  let mockChangeLogRepo: any;
  let mockConfigService: any;
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

    mockOrgUnitsRepo = {
      create: jest.fn(),
      findById: jest.fn(),
    };

    mockClosureRepo = {
      insertNodeClosure: jest.fn(),
      detachSubtree: jest.fn(),
      attachSubtree: jest.fn(),
      getDescendantIds: jest.fn().mockResolvedValue(['u-1', 'u-2', 'u-3']),
      runIntegrityCheck: jest.fn().mockResolvedValue([]),
    };

    mockChangeLogRepo = {
      create: jest.fn().mockResolvedValue(1),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgUnitTreeService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: OrgUnitsRepository, useValue: mockOrgUnitsRepo },
        { provide: OrgUnitClosureRepository, useValue: mockClosureRepo },
        { provide: OrgUnitChangeLogRepository, useValue: mockChangeLogRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OrgUnitTreeService>(OrgUnitTreeService);
  });

  describe('createNode', () => {
    it('creates root node with depth 0 and formatted /ID/ path without dashes', async () => {
      mockOrgUnitsRepo.create.mockImplementation(async (data: any) => ({
        ...data,
        orgUnitId: '11111111-2222-3333-4444-555555555555',
      }));

      const res = await service.createNode(
        {
          orgUnitTypeId: 1,
          code: 'DIEZ',
          name: 'Dubai Integrated Economic Zones',
        },
        'actor-user-1',
        null,
      );

      expect(mockOrgUnitsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          depth: 0,
          materializedPath: expect.stringMatching(/^\/[A-Z0-9]{32}\/$/),
        }),
        mockQueryRunner,
      );
      expect(mockClosureRepo.insertNodeClosure).toHaveBeenCalledWith(
        '11111111-2222-3333-4444-555555555555',
        null,
        mockQueryRunner,
      );
      expect(mockChangeLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changeType: 'CREATED',
          affectedNodeCount: 1,
        }),
        mockQueryRunner,
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('creates child node inheriting parent path and incrementing depth', async () => {
      const parentUnit = {
        orgUnitId: '11111111-2222-3333-4444-555555555555',
        materializedPath: '/11111111222233334444555555555555/',
        depth: 0,
      } as any;

      mockOrgUnitsRepo.create.mockImplementation(async (data: any) => ({
        ...data,
        orgUnitId: '22222222-3333-4444-5555-666666666666',
      }));

      await service.createNode(
        {
          orgUnitTypeId: 2,
          parentOrgUnitId: parentUnit.orgUnitId,
          code: 'DSO',
          name: 'Dubai Silicon Oasis',
        },
        'actor-user-1',
        parentUnit,
      );

      expect(mockOrgUnitsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          depth: 1,
          materializedPath: expect.stringMatching(
            /^\/11111111222233334444555555555555\/[A-Z0-9]{32}\/$/,
          ),
        }),
        mockQueryRunner,
      );
    });
  });

  describe('moveSubtree (§6.2 & §11.1)', () => {
    it('executes full section 6.2 atomic move sequence with lock and concurrency checks', async () => {
      const movingUnit = {
        orgUnitId: '33333333-4444-5555-6666-777777777777',
        orgUnitTypeId: 3,
        parentOrgUnitId: '22222222-3333-4444-5555-666666666666',
        code: 'IT',
        depth: 2,
        materializedPath:
          '/11111111222233334444555555555555/22222222333344445555666666666666/33333333444455556666777777777777/',
        rowVersion: '0x00000000000007D1',
      } as any;

      mockOrgUnitsRepo.findById
        .mockResolvedValueOnce(movingUnit) // initial check
        .mockResolvedValueOnce({
          ...movingUnit,
          parentOrgUnitId: 'new-parent-id',
        }); // after move

      await service.moveSubtree(
        movingUnit.orgUnitId,
        {
          newParentOrgUnitId: 'new-parent-id',
          reason: '2026 restructuring',
          rowVersion: '0x00000000000007D1',
        },
        'actor-admin',
      );

      // 1. UPDLOCK HOLDLOCK acquired
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('WITH (UPDLOCK, HOLDLOCK)'),
        [movingUnit.orgUnitId],
      );

      // 2. Closure detach & attach called in order
      expect(mockClosureRepo.detachSubtree).toHaveBeenCalledWith(
        movingUnit.orgUnitId,
        mockQueryRunner,
      );
      expect(mockClosureRepo.attachSubtree).toHaveBeenCalledWith(
        movingUnit.orgUnitId,
        'new-parent-id',
        mockQueryRunner,
      );

      // 3. Adjacency, depth and CTE path updates called
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'UPDATE org.OrgUnits \n         SET ParentOrgUnitId = @1',
        ),
        [movingUnit.orgUnitId, 'new-parent-id', 'actor-admin'],
      );

      // 4. Change log recorded with affected node count
      expect(mockChangeLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changeType: 'MOVED',
          affectedNodeCount: 3,
          reason: '2026 restructuring',
        }),
        mockQueryRunner,
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('rejects moving root holding unit with ORG_ROOT_PROTECTED', async () => {
      const rootUnit = {
        orgUnitId: 'root-id',
        orgUnitTypeId: 1,
        parentOrgUnitId: null,
        rowVersion: '0x0001',
      } as any;

      mockOrgUnitsRepo.findById.mockResolvedValue(rootUnit);

      await expect(
        service.moveSubtree(
          'root-id',
          { newParentOrgUnitId: 'new-parent', rowVersion: '0x0001' },
          'actor',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_ROOT_PROTECTED },
      });

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('fails with ORG_CONCURRENCY_CONFLICT on RowVersion mismatch', async () => {
      const unit = {
        orgUnitId: 'u-1',
        orgUnitTypeId: 3,
        parentOrgUnitId: 'p-1',
        rowVersion: '0x00000000000007D1',
      } as any;

      mockOrgUnitsRepo.findById.mockResolvedValue(unit);

      await expect(
        service.moveSubtree(
          'u-1',
          { newParentOrgUnitId: 'new-p', rowVersion: '0x0000000000000999' },
          'actor',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_CONCURRENCY_CONFLICT },
      });

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws in debug mode if integrity check returns discrepancies', async () => {
      const unit = {
        orgUnitId: 'u-1',
        orgUnitTypeId: 3,
        parentOrgUnitId: 'p-1',
        rowVersion: '0x0001',
      } as any;

      mockOrgUnitsRepo.findById.mockResolvedValue(unit);
      mockClosureRepo.runIntegrityCheck.mockResolvedValue([
        { orgUnitId: 'u-1', code: 'IT', problem: 'DEPTH_MISMATCH' },
      ]);

      await expect(
        service.moveSubtree(
          'u-1',
          { newParentOrgUnitId: 'new-p', rowVersion: '0x0001' },
          'actor',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        response: { code: 'TREE_INTEGRITY_VIOLATION' },
      });

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
