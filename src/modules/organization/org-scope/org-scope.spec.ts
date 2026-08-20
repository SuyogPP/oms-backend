import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalUserGuard } from './guards/internal-user.guard';
import { OrgScopeRepository } from './repositories/org-scope.repository';
import { OrgScopeResolverService } from './services/org-scope-resolver.service';

describe('OrgScope Submodule (Domain 2 Section 9.3 Scope Enforcement)', () => {
  describe('InternalUserGuard (Section 9.3 Non-Negotiable #4)', () => {
    let guard: InternalUserGuard;

    beforeEach(() => {
      guard = new InternalUserGuard();
    });

    it('allows access for INTERNAL employee users', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'u-1', userType: 'INTERNAL' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(context)).toBe(true);
    });

    it('outright rejects VENDOR users with 403 ORG_VENDOR_ACCESS_DENIED', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: 'v-1', userType: 'VENDOR' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(HttpException);
      try {
        guard.canActivate(context);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(err.getResponse()).toMatchObject({
          code: 'ORG_VENDOR_ACCESS_DENIED',
        });
      }
    });

    it('rejects unauthenticated or missing user objects with 403', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: null,
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(HttpException);
    });
  });

  describe('OrgScopeResolverService', () => {
    let resolverService: OrgScopeResolverService;
    let mockScopeRepo: any;

    const sampleScopes = [
      {
        userOrganizationScopeId: 'scope-1',
        userId: 'u-1',
        scopeCode: 'DEPARTMENT',
        scopeName: 'Department Level',
        departmentId: 'dept-1',
      },
    ];

    const sampleVisibleUnits = [
      {
        orgUnitId: 'unit-1',
        code: 'IT',
        name: 'Information Technology',
        orgUnitTypeId: 3,
      },
      {
        orgUnitId: 'unit-2',
        code: 'SE',
        name: 'Software Engineering',
        orgUnitTypeId: 4,
      },
    ];

    beforeEach(async () => {
      mockScopeRepo = {
        getUserScopes: jest.fn().mockResolvedValue(sampleScopes),
        getVisibleOrgUnitIds: jest.fn().mockResolvedValue(['unit-1', 'unit-2']),
        getVisibleOrgUnits: jest.fn().mockResolvedValue(sampleVisibleUnits),
        isOrgUnitVisible: jest.fn().mockImplementation((userId, orgUnitId) => {
          return Promise.resolve(orgUnitId === 'unit-1' || orgUnitId === 'unit-2');
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OrgScopeResolverService,
          { provide: OrgScopeRepository, useValue: mockScopeRepo },
        ],
      }).compile();

      resolverService = module.get<OrgScopeResolverService>(OrgScopeResolverService);
    });

    it('getUserScopes returns assigned scopes', async () => {
      const res = await resolverService.getUserScopes('u-1');
      expect(res).toEqual(sampleScopes);
      expect(mockScopeRepo.getUserScopes).toHaveBeenCalledWith('u-1');
    });

    it('getVisibleOrgUnitIds returns visible IDs', async () => {
      const res = await resolverService.getVisibleOrgUnitIds('u-1');
      expect(res).toEqual(['unit-1', 'unit-2']);
      expect(mockScopeRepo.getVisibleOrgUnitIds).toHaveBeenCalledWith('u-1');
    });

    it('getVisibleOrgUnits returns visible units', async () => {
      const res = await resolverService.getVisibleOrgUnits('u-1');
      expect(res).toEqual(sampleVisibleUnits);
      expect(mockScopeRepo.getVisibleOrgUnits).toHaveBeenCalledWith('u-1');
    });

    it('isOrgUnitVisible checks visibility correctly', async () => {
      expect(await resolverService.isOrgUnitVisible('u-1', 'unit-1')).toBe(true);
      expect(await resolverService.isOrgUnitVisible('u-1', 'unit-out-of-scope')).toBe(false);
    });
  });
});
