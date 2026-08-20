import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  ORG_ERROR_CODES,
  ORG_MANAGER_ROLES,
} from './org-units.constants';
import { ORG_UNIT_REFERENCE_CHECKS } from './interfaces/org-unit-reference-check.interface';
import { OrgUnitClosureRepository } from './repositories/org-unit-closure.repository';
import { OrgUnitTypesRepository } from './repositories/org-unit-types.repository';
import { OrgUnitsRepository } from './repositories/org-units.repository';
import { OrgUnitValidationService } from './services/org-unit-validation.service';

describe('OrgUnitValidationService (Domain 2 - Section 7 Rules)', () => {
  let service: OrgUnitValidationService;
  let mockOrgUnitsRepo: any;
  let mockClosureRepo: any;
  let mockTypesRepo: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockOrgUnitsRepo = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findActiveRoot: jest.fn(),
      countDirectChildren: jest.fn(),
    };

    mockClosureRepo = {
      isDescendantOf: jest.fn(),
      getDescendantIds: jest.fn(),
    };

    mockTypesRepo = {
      findTypeById: jest.fn(),
      findHierarchyRule: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgUnitValidationService,
        { provide: OrgUnitsRepository, useValue: mockOrgUnitsRepo },
        { provide: OrgUnitClosureRepository, useValue: mockClosureRepo },
        { provide: OrgUnitTypesRepository, useValue: mockTypesRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ORG_UNIT_REFERENCE_CHECKS, useValue: [] },
      ],
    }).compile();

    service = module.get<OrgUnitValidationService>(OrgUnitValidationService);
  });

  describe('Section 7.1: Creation Rules (C1 – C10)', () => {
    it('C1: throws 400 ORG_TYPE_INVALID if unit type does not exist or inactive', async () => {
      mockTypesRepo.findTypeById.mockResolvedValue(null);
      await expect(service.validateC1_TypeExistsAndActive(999)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_TYPE_INVALID },
      });
    });

    it('C2: throws 400 ORG_PARENT_REQUIRED if non-root lacks parent', () => {
      expect(() =>
        service.validateC2_ParentRequiredForNonRoot(false, null),
      ).toThrow(HttpException);
    });

    it('C3: throws 400 ORG_ROOT_CANNOT_HAVE_PARENT if root has parent', () => {
      expect(() =>
        service.validateC3_RootCannotHaveParent(true, 'some-parent-id'),
      ).toThrow(HttpException);
    });

    it('C4: throws 409 ORG_ROOT_EXISTS if active root already exists', async () => {
      mockOrgUnitsRepo.findActiveRoot.mockResolvedValue({ code: 'DIEZ' });
      await expect(service.validateC4_SingleActiveRoot(true)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_ROOT_EXISTS },
      });
    });

    it('C5: throws 400 ORG_HIERARCHY_RULE_VIOLATION if type combination invalid', async () => {
      mockTypesRepo.findHierarchyRule.mockResolvedValue(null);
      await expect(service.validateC5_HierarchyRule(3, 4)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_HIERARCHY_RULE_VIOLATION },
      });
    });

    it('C6: throws 400 ORG_PARENT_INVALID / ORG_PARENT_INACTIVE', async () => {
      mockOrgUnitsRepo.findById.mockResolvedValue({ isActive: false, isDeleted: false });
      await expect(
        service.validateC6_ParentExistsAndActive('parent-1'),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_PARENT_INACTIVE },
      });
    });

    it('C7: throws 409 ORG_CODE_DUPLICATE if sibling with same code exists', async () => {
      mockOrgUnitsRepo.findByCode.mockResolvedValue({ orgUnitId: 'u-1', code: 'IT' });
      await expect(
        service.validateC7_CodeUniqueAmongSiblings('p-1', 'IT'),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_CODE_DUPLICATE },
      });
    });

    it('C8: throws 400 ORG_CODE_FORMAT on invalid regex', () => {
      expect(() => service.validateC8_CodeFormat('it#123')).toThrow(HttpException);
    });

    it('C9: throws 400 ORG_EFFECTIVE_BEFORE_PARENT if child date before parent date', () => {
      expect(() =>
        service.validateC9_EffectiveFromNotBeforeParent('2026-01-01', '2026-06-01'),
      ).toThrow(HttpException);
    });

    it('C10: throws 403 ORG_SCOPE_DENIED if creator lacks scope over parent', async () => {
      mockDataSource.query.mockResolvedValue([]);
      await expect(
        service.validateC10_CreatorScope('p-1', 'user-1'),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: ORG_ERROR_CODES.ORG_SCOPE_DENIED },
      });
    });
  });

  describe('Section 7.2: Move Rules (M1 – M8)', () => {
    it('M1: throws 400 ORG_PARENT_INVALID if target parent missing or inactive', async () => {
      mockOrgUnitsRepo.findById.mockResolvedValue(null);
      await expect(
        service.validateM1_NewParentExistsAndActive('new-p'),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_PARENT_INVALID },
      });
    });

    it('M2: throws 400 ORG_MOVE_TO_SELF if moving unit under itself', () => {
      expect(() => service.validateM2_NotMovingToSelf('u-1', 'u-1')).toThrow(
        HttpException,
      );
    });

    it('M3: throws 400 ORG_MOVE_CYCLE if moving under a descendant', async () => {
      mockClosureRepo.isDescendantOf.mockResolvedValue(true);
      await expect(
        service.validateM3_NotMovingToDescendant('u-1', 'u-descendant'),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_MOVE_CYCLE },
      });
    });

    it('M5: throws 409 ORG_CODE_DUPLICATE if code exists under new parent', async () => {
      mockOrgUnitsRepo.findByCode.mockResolvedValue({ orgUnitId: 'other-u', code: 'IT' });
      await expect(
        service.validateM5_CodeUniqueAmongNewSiblings('u-1', 'new-p', 'IT'),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_CODE_DUPLICATE },
      });
    });

    it('M8: throws 409 ORG_CONCURRENCY_CONFLICT on RowVersion mismatch', () => {
      expect(() =>
        service.validateM8_RowVersionConcurrency('0x0001', '0x0002'),
      ).toThrow(HttpException);
    });
  });

  describe('Section 7.3: Deactivate / Delete Rules (D1 – D5)', () => {
    it('D1: throws 409 ORG_HAS_ACTIVE_CHILDREN on deactivate with active children', async () => {
      mockOrgUnitsRepo.countDirectChildren.mockResolvedValue(2);
      await expect(
        service.validateD1_NoActiveChildrenOnDeactivate('u-1'),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_HAS_ACTIVE_CHILDREN },
      });
    });

    it('D2: throws 409 ORG_HAS_CHILDREN on delete with children', async () => {
      mockOrgUnitsRepo.countDirectChildren.mockResolvedValue(1);
      await expect(
        service.validateD2_NoChildrenOnDelete('u-1'),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_HAS_CHILDREN },
      });
    });

    it('D3: throws 409 ORG_HAS_ASSIGNED_USERS on delete with users', async () => {
      mockDataSource.query.mockResolvedValue([{ total: 3 }]);
      await expect(
        service.validateD3_NoAssignedUsersOnDelete('u-1'),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_HAS_ASSIGNED_USERS },
      });
    });

    it('D5: throws 409 ORG_ROOT_PROTECTED when attempting to delete root', () => {
      expect(() =>
        service.validateD5_RootProtected({ parentOrgUnitId: null, orgUnitTypeId: 1 } as any),
      ).toThrow(HttpException);
    });
  });

  describe('Section 7.4: Manager Rules (G1 – G5)', () => {
    it('G1: throws 409 ORG_PRIMARY_HEAD_EXISTS if another active primary head exists in range', async () => {
      mockDataSource.query.mockResolvedValue([{ existsPrimary: 1 }]);
      await expect(
        service.validateG1_PrimaryHeadUniqueness('u-1', '2026-01-01', null),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_PRIMARY_HEAD_EXISTS },
      });
    });

    it('G3: throws 409 ORG_MANAGER_PERIOD_OVERLAP if tenure overlaps', async () => {
      mockDataSource.query.mockResolvedValue([{ isOverlap: 1 }]);
      await expect(
        service.validateG3_NoManagerPeriodOverlap(
          'u-1',
          'user-1',
          ORG_MANAGER_ROLES.HEAD,
          '2026-01-01',
          '2026-12-31',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: ORG_ERROR_CODES.ORG_MANAGER_PERIOD_OVERLAP },
      });
    });

    it('G4: throws 400 ORG_MANAGER_INVALID_USER if user is inactive or vendor', async () => {
      mockDataSource.query.mockResolvedValue([
        { UserID: 'user-v', UserType: 'VENDOR', IsActive: 1, IsDeleted: 0 },
      ]);
      await expect(
        service.validateG4_UserIsActiveAndInternal('user-v'),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_MANAGER_INVALID_USER },
      });
    });

    it('G5: throws 400 ORG_TYPE_NO_MANAGER if unit type disallows managers', async () => {
      mockTypesRepo.findTypeById.mockResolvedValue({
        code: 'HOLDING',
        allowsManager: false,
      });
      await expect(
        service.validateG5_UnitTypeAllowsManager(1),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: ORG_ERROR_CODES.ORG_TYPE_NO_MANAGER },
      });
    });
  });
});
