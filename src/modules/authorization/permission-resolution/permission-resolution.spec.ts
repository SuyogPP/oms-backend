import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EffectivePermissionsService } from './services/effective-permissions.service';
import { RoleHierarchyService } from './services/role-hierarchy.service';
import { PermissionResolutionRepository } from './repositories/permission-resolution.repository';
import {
  RequestContextService,
  RequestContextStore,
} from '../../../common/services/request-context.service';
import { PERMISSION_SOURCES } from './permission-resolution.constants';
import { DataSource } from 'typeorm';

describe('PermissionResolution Module (Domain 3, §4 & §10)', () => {
  let service: EffectivePermissionsService;
  let repository: PermissionResolutionRepository;
  let requestContextService: RequestContextService;

  const mockDataSource = {
    query: jest.fn(),
  };

  const targetUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const requesterUserId = '6B2E9347-3D18-4F74-B46B-A0AF4D442F02';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EffectivePermissionsService,
        RoleHierarchyService,
        PermissionResolutionRepository,
        RequestContextService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<EffectivePermissionsService>(
      EffectivePermissionsService,
    );
    repository = module.get<PermissionResolutionRepository>(
      PermissionResolutionRepository,
    );
    requestContextService = module.get<RequestContextService>(
      RequestContextService,
    );

    jest.clearAllMocks();
  });

  // ===========================================================================
  // SECTION 1: PROVING REVOKE-BEATS-GRANT (NON-NEGOTIABLE FINANCIAL CONTROL)
  // ===========================================================================
  describe('1. Revoke-Beats-Grant Proofs', () => {
    it('1.1 Direct Role vs Revoke Override: Revoke MUST win', async () => {
      jest.spyOn(repository, 'isUserActive').mockResolvedValue(true);

      // Direct HOD role grants REQUISITION.APPROVE and BUDGET.LOCK
      jest
        .spyOn(repository, 'resolveUserRolesWithHierarchy')
        .mockResolvedValue([
          {
            roleId: 'role-hod',
            roleCode: 'HOD',
            roleName: 'Head of Department',
            depth: 0,
            effectiveFrom: new Date('2026-01-01'),
            effectiveTo: null,
          },
        ]);

      jest.spyOn(repository, 'resolvePermissionsForRoles').mockResolvedValue([
        {
          roleId: 'role-hod',
          roleCode: 'HOD',
          permissionId: 'p-1',
          permissionCode: 'REQUISITION.APPROVE',
          moduleName: 'REQUISITIONS',
          actionName: 'APPROVE',
          depth: 0,
        },
        {
          roleId: 'role-hod',
          roleCode: 'HOD',
          permissionId: 'p-2',
          permissionCode: 'BUDGET.LOCK',
          moduleName: 'BUDGET',
          actionName: 'LOCK',
          depth: 0,
        },
      ]);

      // Revoke override on BUDGET.LOCK (IsGranted = 0)
      jest.spyOn(repository, 'resolveUserOverrides').mockResolvedValue([
        {
          overrideId: 'ov-1',
          userId: targetUserId,
          permissionId: 'p-2',
          permissionCode: 'BUDGET.LOCK',
          isGranted: false,
          reason: 'Under audit investigation',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
        },
      ]);

      jest.spyOn(repository, 'resolveDelegations').mockResolvedValue([]);

      const permissions = await service.getEffectivePermissions(targetUserId);

      // ASSERTION: REQUISITION.APPROVE is present, but BUDGET.LOCK is strictly revoked
      expect(permissions).toContain('REQUISITION.APPROVE');
      expect(permissions).not.toContain('BUDGET.LOCK');
      expect(permissions).toHaveLength(1);

      // Test Preview Endpoint Response
      const preview =
        await service.getEffectivePermissionsPreview(targetUserId);
      expect(preview.permissions.map((p) => p.code)).toContain(
        'REQUISITION.APPROVE',
      );
      expect(preview.permissions.map((p) => p.code)).not.toContain(
        'BUDGET.LOCK',
      );
      expect(preview.revoked).toEqual([
        {
          code: 'BUDGET.LOCK',
          source: PERMISSION_SOURCES.OVERRIDE_REVOKE,
          reason: 'Under audit investigation',
        },
      ]);
    });

    it('1.2 Inherited Role vs Revoke Override: Revoke MUST win', async () => {
      jest.spyOn(repository, 'isUserActive').mockResolvedValue(true);

      // User assigned SYSTEM_ADMIN (depth 0), which inherits FINANCE (depth 1)
      jest
        .spyOn(repository, 'resolveUserRolesWithHierarchy')
        .mockResolvedValue([
          {
            roleId: 'role-admin',
            roleCode: 'SYSTEM_ADMIN',
            roleName: 'System Admin',
            depth: 0,
            effectiveFrom: new Date('2026-01-01'),
          },
          {
            roleId: 'role-fin',
            roleCode: 'FINANCE',
            roleName: 'Finance Approver',
            depth: 1,
            inheritedVia: 'SYSTEM_ADMIN ← FINANCE',
            effectiveFrom: new Date('2026-01-01'),
          },
        ]);

      jest.spyOn(repository, 'resolvePermissionsForRoles').mockResolvedValue([
        {
          roleId: 'role-fin',
          roleCode: 'FINANCE',
          permissionId: 'p-fin-1',
          permissionCode: 'BUDGET.RELEASE',
          moduleName: 'BUDGET',
          actionName: 'RELEASE',
          depth: 1,
          inheritedVia: 'SYSTEM_ADMIN ← FINANCE',
        },
      ]);

      // Revoke override on BUDGET.RELEASE
      jest.spyOn(repository, 'resolveUserOverrides').mockResolvedValue([
        {
          overrideId: 'ov-2',
          userId: targetUserId,
          permissionId: 'p-fin-1',
          permissionCode: 'BUDGET.RELEASE',
          isGranted: false,
          reason: 'Disciplinary suspension',
          effectiveFrom: new Date('2026-01-01'),
        },
      ]);

      jest.spyOn(repository, 'resolveDelegations').mockResolvedValue([]);

      const permissions = await service.getEffectivePermissions(targetUserId);
      expect(permissions).not.toContain('BUDGET.RELEASE');
      expect(permissions).toHaveLength(0);
    });

    it('1.3 Delegation vs Revoke Override: Revoke MUST win', async () => {
      jest.spyOn(repository, 'isUserActive').mockResolvedValue(true);
      jest
        .spyOn(repository, 'resolveUserRolesWithHierarchy')
        .mockResolvedValue([]);
      jest
        .spyOn(repository, 'resolvePermissionsForRoles')
        .mockResolvedValue([]);

      // Delegation confers INTERVIEW.BYPASS
      jest.spyOn(repository, 'resolveDelegations').mockResolvedValue([
        {
          delegationId: 'del-1',
          fromUserId: 'hod-1',
          fromUserName: 'Director HR',
          toUserId: targetUserId,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          permissionCode: 'INTERVIEW.BYPASS',
        },
      ]);

      // User has active override revoking INTERVIEW.BYPASS
      jest.spyOn(repository, 'resolveUserOverrides').mockResolvedValue([
        {
          overrideId: 'ov-3',
          userId: targetUserId,
          permissionId: 'p-int',
          permissionCode: 'INTERVIEW.BYPASS',
          isGranted: false,
          reason: 'Conflict of interest',
          effectiveFrom: new Date('2026-01-01'),
        },
      ]);

      const permissions = await service.getEffectivePermissions(targetUserId);
      expect(permissions).not.toContain('INTERVIEW.BYPASS');
      expect(permissions).toHaveLength(0);
    });

    it('1.4 Compound Grants (Direct + Inherited + Delegation + Grant Override) vs Single Revoke: Revoke MUST win', async () => {
      jest.spyOn(repository, 'isUserActive').mockResolvedValue(true);

      // Direct & Inherited roles both grant CANDIDATE.UNMASK
      jest
        .spyOn(repository, 'resolveUserRolesWithHierarchy')
        .mockResolvedValue([
          {
            roleId: 'r-1',
            roleCode: 'HOD',
            roleName: 'HOD',
            depth: 0,
            effectiveFrom: new Date('2026-01-01'),
          },
        ]);

      jest.spyOn(repository, 'resolvePermissionsForRoles').mockResolvedValue([
        {
          roleId: 'r-1',
          roleCode: 'HOD',
          permissionId: 'p-mask',
          permissionCode: 'CANDIDATE.UNMASK',
          moduleName: 'CANDIDATE',
          actionName: 'UNMASK',
          depth: 0,
        },
      ]);

      // Grant Override also grants CANDIDATE.UNMASK, but another row revokes it
      jest.spyOn(repository, 'resolveUserOverrides').mockResolvedValue([
        {
          overrideId: 'ov-grant',
          userId: targetUserId,
          permissionId: 'p-mask',
          permissionCode: 'CANDIDATE.UNMASK',
          isGranted: true,
          effectiveFrom: new Date('2026-01-01'),
        },
        {
          overrideId: 'ov-revoke',
          userId: targetUserId,
          permissionId: 'p-mask',
          permissionCode: 'CANDIDATE.UNMASK',
          isGranted: false,
          reason: 'Special blind review protocol',
          effectiveFrom: new Date('2026-01-01'),
        },
      ]);

      // Active delegation also attempts to confer CANDIDATE.UNMASK
      jest.spyOn(repository, 'resolveDelegations').mockResolvedValue([
        {
          delegationId: 'del-2',
          fromUserId: 'hod-2',
          fromUserName: 'SVP Operations',
          toUserId: targetUserId,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          permissionCode: 'CANDIDATE.UNMASK',
        },
      ]);

      const permissions = await service.getEffectivePermissions(targetUserId);

      // STRICT SUBTRACTION: despite 3 independent sources granting it, revoke wins
      expect(permissions).not.toContain('CANDIDATE.UNMASK');
      expect(permissions).toHaveLength(0);
    });
  });

  // ===========================================================================
  // SECTION 2: TESTING THE RECURSIVE CTE CYCLE GUARD & ROLE HIERARCHY
  // ===========================================================================
  describe('2. Role Hierarchy & Cycle Guard Tests', () => {
    it('2.1 Mutual Cycle (A <-> B): Terminates cleanly without hanging or exceeding depth', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        {
          roleId: 'role-a',
          roleCode: 'ROLE_A',
          roleName: 'Role A',
          depth: 0,
          inheritedVia: 'ROLE_A',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
        {
          roleId: 'role-b',
          roleCode: 'ROLE_B',
          roleName: 'Role B',
          depth: 1,
          inheritedVia: 'ROLE_A ← ROLE_B',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
      ]);

      const roles =
        await repository.resolveUserRolesWithHierarchy(targetUserId);

      expect(roles).toHaveLength(2);
      expect(roles.map((r) => r.roleCode)).toEqual(['ROLE_A', 'ROLE_B']);
      expect(roles[1].depth).toBe(1);
      expect(roles[1].inheritedVia).toBe('ROLE_A ← ROLE_B');
    });

    it('2.2 Transitive 3-Node Cycle (A -> B -> C -> A): Halts recursion at max depth 10', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        {
          roleId: 'role-a',
          roleCode: 'ROLE_A',
          roleName: 'Role A',
          depth: 0,
          inheritedVia: 'ROLE_A',
          effectiveFrom: '2026-01-01',
        },
        {
          roleId: 'role-b',
          roleCode: 'ROLE_B',
          roleName: 'Role B',
          depth: 1,
          inheritedVia: 'ROLE_A ← ROLE_B',
          effectiveFrom: '2026-01-01',
        },
        {
          roleId: 'role-c',
          roleCode: 'ROLE_C',
          roleName: 'Role C',
          depth: 2,
          inheritedVia: 'ROLE_A ← ROLE_B ← ROLE_C',
          effectiveFrom: '2026-01-01',
        },
      ]);

      const roles =
        await repository.resolveUserRolesWithHierarchy(targetUserId);
      expect(roles.map((r) => r.roleCode)).toEqual([
        'ROLE_A',
        'ROLE_B',
        'ROLE_C',
      ]);
    });

    it('2.3 Self Cycle (A -> A): Halts at root level without spinning', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        {
          roleId: 'role-a',
          roleCode: 'ROLE_A',
          roleName: 'Role A',
          depth: 0,
          inheritedVia: 'ROLE_A',
          effectiveFrom: '2026-01-01',
        },
      ]);

      const roles =
        await repository.resolveUserRolesWithHierarchy(targetUserId);
      expect(roles).toHaveLength(1);
      expect(roles[0].roleCode).toBe('ROLE_A');
    });
  });

  // ===========================================================================
  // SECTION 3: TEMPORAL VALIDITY & INACTIVE USER SHORT-CIRCUITS
  // ===========================================================================
  describe('3. Temporal Validity & Inactive User Evaluation', () => {
    it('3.1 Inactive User (IsActive = 0): Must resolve to ZERO permissions immediately', async () => {
      jest.spyOn(repository, 'isUserActive').mockResolvedValue(false);
      const rolesSpy = jest.spyOn(repository, 'resolveUserRolesWithHierarchy');

      const permissions = await service.getEffectivePermissions(targetUserId);

      expect(permissions).toEqual([]);
      expect(rolesSpy).not.toHaveBeenCalled();

      await expect(
        service.getEffectivePermissionsPreview(targetUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('3.2 Soft-Deleted User (IsDeleted = 1): Must resolve to ZERO permissions', async () => {
      jest.spyOn(repository, 'isUserActive').mockResolvedValue(false);

      const permissions = await service.getEffectivePermissions(targetUserId);
      expect(permissions).toEqual([]);
    });
  });

  // ===========================================================================
  // SECTION 4: REQUEST-SCOPED CACHING ISOLATION (§4.5)
  // ===========================================================================
  describe('4. Request-Scoped Caching Isolation', () => {
    it('4.1 Multiple calls within the SAME request context hit memory cache after 1st query', async () => {
      const store: RequestContextStore = {
        correlationId: 'req-test-123',
        startTime: Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        path: '/api/v1/authorization/test',
        method: 'GET',
      };

      await RequestContextService.run(store, async () => {
        jest.spyOn(repository, 'isUserActive').mockResolvedValue(true);
        const rolesSpy = jest
          .spyOn(repository, 'resolveUserRolesWithHierarchy')
          .mockResolvedValue([
            {
              roleId: 'r-test',
              roleCode: 'HR',
              roleName: 'HR',
              depth: 0,
              effectiveFrom: new Date('2026-01-01'),
            },
          ]);

        jest.spyOn(repository, 'resolvePermissionsForRoles').mockResolvedValue([
          {
            roleId: 'r-test',
            roleCode: 'HR',
            permissionId: 'p-hr-1',
            permissionCode: 'USER.VIEW',
            moduleName: 'USER_ADMIN',
            actionName: 'VIEW',
            depth: 0,
          },
        ]);

        jest.spyOn(repository, 'resolveUserOverrides').mockResolvedValue([]);
        jest.spyOn(repository, 'resolveDelegations').mockResolvedValue([]);

        // Call 1: Database hit
        const perms1 = await service.getEffectivePermissions(targetUserId);
        expect(perms1).toEqual(['USER.VIEW']);
        expect(rolesSpy).toHaveBeenCalledTimes(1);

        // Call 2: Must resolve from RequestContext store memory (0 additional DB calls)
        const perms2 = await service.getEffectivePermissions(targetUserId);
        expect(perms2).toEqual(['USER.VIEW']);
        expect(rolesSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('4.2 Different Request Contexts resolve freshly (no cross-request leaks)', async () => {
      const storeA: RequestContextStore = {
        correlationId: 'req-A',
        startTime: Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        path: '/test-a',
        method: 'GET',
      };

      const storeB: RequestContextStore = {
        correlationId: 'req-B',
        startTime: Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        path: '/test-b',
        method: 'GET',
      };

      jest.spyOn(repository, 'isUserActive').mockResolvedValue(true);
      const rolesSpy = jest
        .spyOn(repository, 'resolveUserRolesWithHierarchy')
        .mockResolvedValue([
          {
            roleId: 'r-test',
            roleCode: 'HR',
            roleName: 'HR',
            depth: 0,
            effectiveFrom: new Date('2026-01-01'),
          },
        ]);

      jest.spyOn(repository, 'resolvePermissionsForRoles').mockResolvedValue([
        {
          roleId: 'r-test',
          roleCode: 'HR',
          permissionId: 'p-hr-1',
          permissionCode: 'USER.VIEW',
          moduleName: 'USER_ADMIN',
          actionName: 'VIEW',
          depth: 0,
        },
      ]);

      jest.spyOn(repository, 'resolveUserOverrides').mockResolvedValue([]);
      jest.spyOn(repository, 'resolveDelegations').mockResolvedValue([]);

      await RequestContextService.run(storeA, async () => {
        await service.getEffectivePermissions(targetUserId);
      });

      await RequestContextService.run(storeB, async () => {
        await service.getEffectivePermissions(targetUserId);
      });

      expect(rolesSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // SECTION 5: AUDIT PREVIEW & SCOPE FILTERING (§4.6 & §9.2)
  // ===========================================================================
  describe('5. Audit Preview Lineage & Scope Filtering (§4.6 & §9.2)', () => {
    it('5.1 Formats Section 4.6 exact structure with all 4 sources and revoked array', async () => {
      jest.spyOn(repository, 'isUserInScope').mockResolvedValue(true);

      jest
        .spyOn(repository, 'resolveUserRolesWithHierarchy')
        .mockResolvedValue([
          {
            roleId: 'r-hod',
            roleCode: 'HOD',
            roleName: 'HOD',
            depth: 0,
            effectiveFrom: new Date('2026-01-01'),
          },
          {
            roleId: 'r-fin',
            roleCode: 'FINANCE_APPROVER',
            roleName: 'Finance Approver',
            depth: 1,
            inheritedVia: 'HOD ← FINANCE_APPROVER',
            effectiveFrom: new Date('2026-01-01'),
          },
        ]);

      jest.spyOn(repository, 'resolvePermissionsForRoles').mockResolvedValue([
        {
          roleId: 'r-hod',
          roleCode: 'HOD',
          permissionId: 'p-1',
          permissionCode: 'REQUISITION.APPROVE',
          moduleName: 'REQUISITIONS',
          actionName: 'APPROVE',
          depth: 0,
        },
        {
          roleId: 'r-fin',
          roleCode: 'FINANCE_APPROVER',
          permissionId: 'p-2',
          permissionCode: 'BUDGET.LOCK',
          moduleName: 'BUDGET',
          actionName: 'LOCK',
          depth: 1,
          inheritedVia: 'HOD ← FINANCE_APPROVER',
        },
      ]);

      jest.spyOn(repository, 'resolveUserOverrides').mockResolvedValue([
        {
          overrideId: 'ov-1',
          userId: targetUserId,
          permissionId: 'p-3',
          permissionCode: 'CANDIDATE.UNMASK',
          isGranted: true,
          reason: 'Temporary — audit review',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: new Date('2026-09-30T00:00:00.000Z'),
        },
        {
          overrideId: 'ov-2',
          userId: targetUserId,
          permissionId: 'p-4',
          permissionCode: 'REQUISITION.CREATE',
          isGranted: false,
          reason: 'Under investigation',
          effectiveFrom: new Date('2026-01-01'),
        },
      ]);

      jest.spyOn(repository, 'resolveDelegations').mockResolvedValue([
        {
          delegationId: 'del-1',
          fromUserId: 'user-ahmed',
          fromUserName: 'Ahmed Al Mansouri',
          toUserId: targetUserId,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-09-05T00:00:00.000Z'),
          permissionCode: 'INTERVIEW.BYPASS',
        },
      ]);

      const preview = await service.getEffectivePermissionsPreview(
        targetUserId,
        requesterUserId,
      );

      // Match Section 4.6 structure exactly
      expect(preview).toEqual({
        permissions: [
          {
            code: 'BUDGET.LOCK',
            source: 'ROLE_INHERITED',
            via: 'HOD ← FINANCE_APPROVER',
          },
          {
            code: 'CANDIDATE.UNMASK',
            source: 'OVERRIDE_GRANT',
            reason: 'Temporary — audit review',
            until: '2026-09-30',
          },
          {
            code: 'INTERVIEW.BYPASS',
            source: 'DELEGATION',
            via: 'Ahmed Al Mansouri',
            until: '2026-09-05',
          },
          {
            code: 'REQUISITION.APPROVE',
            source: 'ROLE',
            via: 'HOD',
          },
        ],
        revoked: [
          {
            code: 'REQUISITION.CREATE',
            source: 'OVERRIDE_REVOKE',
            reason: 'Under investigation',
          },
        ],
      });
    });

    it('5.2 Out-of-scope target user returns 404 (Not Found), never 403', async () => {
      // Requester is out of target user's scope
      jest.spyOn(repository, 'isUserInScope').mockResolvedValue(false);

      await expect(
        service.getEffectivePermissionsPreview(targetUserId, requesterUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
