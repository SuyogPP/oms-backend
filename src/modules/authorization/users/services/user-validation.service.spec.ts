import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserValidationService } from './user-validation.service';
import { UsersRepository } from '../repositories/users.repository';
import { USER_ERROR_CODES, USER_TYPES, SCOPE_CODES } from '../users.constants';

describe('UserValidationService (Domain 3, §§5.1, 5.5, 6.1, 6.2, 7, 9.1)', () => {
  let service: UserValidationService;
  let usersRepository: UsersRepository;

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
    countActiveSystemAdmins: jest.fn(),
    isUserPrimaryHeadOfAnyOrgUnit: jest.fn(),
  };

  const targetUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const operatorUserId = '2053433E-F36B-1410-85ED-009A959FB233';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserValidationService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserValidationService>(UserValidationService);
    usersRepository = module.get<UsersRepository>(UsersRepository);

    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. HIGHEST-CONSEQUENCE RULES (U14/9.1, U15, U16, S4, V3/V4)
  // ===========================================================================
  describe('1. Highest-Consequence Rules', () => {
    describe('U14 & §9.1: Self-Action Prevention', () => {
      it('rejects deactivating own account with 409 USER_SELF_ACTION', () => {
        expect(() => {
          service.validateU14_SelfAction(
            targetUserId,
            targetUserId,
            'deactivate your own account',
          );
        }).toThrow(
          expect.objectContaining({
            status: HttpStatus.CONFLICT,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.USER_SELF_ACTION,
            }),
          }),
        );
      });

      it('rejects deleting own account with 409 USER_SELF_ACTION', () => {
        expect(() => {
          service.validateU14_SelfAction(
            targetUserId,
            targetUserId,
            'delete your own account',
          );
        }).toThrow(
          expect.objectContaining({
            status: HttpStatus.CONFLICT,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.USER_SELF_ACTION,
            }),
          }),
        );
      });

      it('rejects assigning roles to self with 409 USER_SELF_ACTION', () => {
        expect(() => {
          service.validateU14_SelfAction(
            targetUserId,
            targetUserId,
            'assign roles to yourself',
          );
        }).toThrow(
          expect.objectContaining({
            status: HttpStatus.CONFLICT,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.USER_SELF_ACTION,
            }),
          }),
        );
      });

      it('rejects assigning organizational scope to self with 409 USER_SELF_ACTION', () => {
        expect(() => {
          service.validateU14_SelfAction(
            targetUserId,
            targetUserId,
            'assign organizational scope to yourself',
          );
        }).toThrow(
          expect.objectContaining({
            status: HttpStatus.CONFLICT,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.USER_SELF_ACTION,
            }),
          }),
        );
      });

      it('rejects managing overrides on self with 409 USER_SELF_ACTION', () => {
        expect(() => {
          service.validateU14_SelfAction(
            targetUserId,
            targetUserId,
            'grant or revoke permission overrides on your own account',
          );
        }).toThrow(
          expect.objectContaining({
            status: HttpStatus.CONFLICT,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.USER_SELF_ACTION,
            }),
          }),
        );
      });

      it('passes when operator is distinct from target user', () => {
        expect(() => {
          service.validateU14_SelfAction(
            targetUserId,
            operatorUserId,
            'deactivate user',
          );
        }).not.toThrow();
      });
    });

    describe('U15: Last Active SYSTEM_ADMIN Guard', () => {
      it('blocks deactivating/deleting user if they are the last active SYSTEM_ADMIN with 409 USER_LAST_ADMIN', async () => {
        // User holds SYSTEM_ADMIN role
        mockDataSource.query.mockResolvedValueOnce([{ 1: 1 }]);
        // Only 1 active system admin in total
        mockUsersRepository.countActiveSystemAdmins.mockResolvedValueOnce(1);

        await expect(
          service.validateU15_LastSystemAdmin(targetUserId),
        ).rejects.toThrow(
          expect.objectContaining({
            status: HttpStatus.CONFLICT,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.USER_LAST_ADMIN,
            }),
          }),
        );
      });

      it('allows deactivating/deleting system admin if 2 or more active system admins exist', async () => {
        // User holds SYSTEM_ADMIN role
        mockDataSource.query.mockResolvedValueOnce([{ 1: 1 }]);
        // 3 active system admins exist
        mockUsersRepository.countActiveSystemAdmins.mockResolvedValueOnce(3);

        await expect(
          service.validateU15_LastSystemAdmin(targetUserId),
        ).resolves.not.toThrow();
      });

      it('allows deactivating/deleting non-admin user even if only 1 system admin exists in the system', async () => {
        // User does not hold SYSTEM_ADMIN role
        mockDataSource.query.mockResolvedValueOnce([]);

        await expect(
          service.validateU15_LastSystemAdmin(targetUserId),
        ).resolves.not.toThrow();
        expect(
          mockUsersRepository.countActiveSystemAdmins,
        ).not.toHaveBeenCalled();
      });
    });

    describe('U16: Primary Org Unit Head Guard', () => {
      it('blocks deleting user if user is currently assigned as primary head of an active org unit with 409 USER_IS_ORG_HEAD', async () => {
        mockUsersRepository.isUserPrimaryHeadOfAnyOrgUnit.mockResolvedValueOnce(
          true,
        );

        await expect(
          service.validateU16_PrimaryOrgUnitHead(targetUserId),
        ).rejects.toThrow(
          expect.objectContaining({
            status: HttpStatus.CONFLICT,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.USER_IS_ORG_HEAD,
            }),
          }),
        );
      });

      it('allows deleting user if user is not a primary head of any org unit', async () => {
        mockUsersRepository.isUserPrimaryHeadOfAnyOrgUnit.mockResolvedValueOnce(
          false,
        );

        await expect(
          service.validateU16_PrimaryOrgUnitHead(targetUserId),
        ).resolves.not.toThrow();
      });
    });

    describe('S4: Scope Escalation Prevention', () => {
      it('blocks granter with DEPARTMENT scope from granting BUSINESS_UNIT scope with 403 SCOPE_ESCALATION', async () => {
        // Granter does not have GLOBAL scope
        mockDataSource.query.mockResolvedValueOnce([]);
        // Granter has active DEPARTMENT scope (depth 3)
        mockDataSource.query.mockResolvedValueOnce([
          { scopeCode: 'DEPARTMENT' },
        ]);

        await expect(
          service.validateS4_ScopeEscalation(
            SCOPE_CODES.BUSINESS_UNIT,
            'bu-uuid',
            operatorUserId,
          ),
        ).rejects.toThrow(
          expect.objectContaining({
            status: HttpStatus.FORBIDDEN,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.SCOPE_ESCALATION,
            }),
          }),
        );
      });

      it('blocks granter without GLOBAL scope from granting GLOBAL scope with 403 SCOPE_ESCALATION', async () => {
        // Granter does not have GLOBAL scope
        mockDataSource.query.mockResolvedValueOnce([]);

        await expect(
          service.validateS4_ScopeEscalation(
            SCOPE_CODES.GLOBAL,
            null,
            operatorUserId,
          ),
        ).rejects.toThrow(
          expect.objectContaining({
            status: HttpStatus.FORBIDDEN,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.SCOPE_ESCALATION,
            }),
          }),
        );
      });

      it('blocks granter from granting scope on an org unit outside their visible hierarchy with 403 SCOPE_ESCALATION', async () => {
        // Granter does not have GLOBAL scope
        mockDataSource.query.mockResolvedValueOnce([]);
        // Granter has active DEPARTMENT scope
        mockDataSource.query.mockResolvedValueOnce([
          { scopeCode: 'DEPARTMENT' },
        ]);
        // Visible org units query returns 0 rows (unit is outside visible subtree)
        mockDataSource.query.mockResolvedValueOnce([]);

        await expect(
          service.validateS4_ScopeEscalation(
            SCOPE_CODES.DEPARTMENT,
            'dept-outside-uuid',
            operatorUserId,
          ),
        ).rejects.toThrow(
          expect.objectContaining({
            status: HttpStatus.FORBIDDEN,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.SCOPE_ESCALATION,
            }),
          }),
        );
      });

      it('allows granter with GLOBAL scope to grant any scope', async () => {
        // Granter has GLOBAL scope
        mockDataSource.query.mockResolvedValueOnce([{ 1: 1 }]);

        await expect(
          service.validateS4_ScopeEscalation(
            SCOPE_CODES.ORGANIZATION,
            'org-uuid',
            operatorUserId,
          ),
        ).resolves.not.toThrow();
      });
    });

    describe('V3 & V4: Vendor Role & Scope Restrictions', () => {
      it('V3: blocks assigning internal role to VENDOR user with 400 VENDOR_ROLE_INVALID', async () => {
        // Role is an internal role (e.g. HOD)
        mockDataSource.query.mockResolvedValueOnce([
          { RoleCode: 'HOD', RoleName: 'Head of Department' },
        ]);

        await expect(
          service.validateV3_VendorRoles(USER_TYPES.VENDOR, 'role-hod-uuid'),
        ).rejects.toThrow(
          expect.objectContaining({
            status: HttpStatus.BAD_REQUEST,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.VENDOR_ROLE_INVALID,
            }),
          }),
        );
      });

      it('V3: allows assigning vendor role (VENDOR_PORTAL_USER) to VENDOR user', async () => {
        mockDataSource.query.mockResolvedValueOnce([
          { RoleCode: 'VENDOR_PORTAL_USER', RoleName: 'Vendor Portal User' },
        ]);

        await expect(
          service.validateV3_VendorRoles(USER_TYPES.VENDOR, 'role-vendor-uuid'),
        ).resolves.not.toThrow();
      });

      it('V4 & S5: blocks assigning organizational scope to VENDOR user with 400 SCOPE_VENDOR_NOT_ALLOWED', () => {
        expect(() => {
          service.validateS5_VendorScopeRestriction(USER_TYPES.VENDOR);
        }).toThrow(
          expect.objectContaining({
            status: HttpStatus.BAD_REQUEST,
            response: expect.objectContaining({
              code: USER_ERROR_CODES.SCOPE_VENDOR_NOT_ALLOWED,
            }),
          }),
        );
      });
    });
  });

  // ===========================================================================
  // 2. SECTION 6.1 & 6.2 SCOPE VALIDATION (S1 & S2)
  // ===========================================================================
  describe('2. Section 6.1 & 6.2 Scope Column & Type Validation', () => {
    it('S1: GLOBAL scope rejects any populated org unit column with 400 SCOPE_ASSIGNMENT_INVALID', () => {
      expect(() => {
        service.validateS1_ScopeColumns(SCOPE_CODES.GLOBAL, {
          departmentId: 'dept-123',
        });
      }).toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
          }),
        }),
      );
    });

    it('S1: DEPARTMENT scope rejects if BusinessUnitID is populated with 400 SCOPE_ASSIGNMENT_INVALID', () => {
      expect(() => {
        service.validateS1_ScopeColumns(SCOPE_CODES.DEPARTMENT, {
          departmentId: 'dept-123',
          businessUnitId: 'bu-123',
        });
      }).toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
          }),
        }),
      );
    });

    it('S1: DEPARTMENT scope succeeds when only departmentId/orgUnitId is populated', () => {
      const unitId = service.validateS1_ScopeColumns(SCOPE_CODES.DEPARTMENT, {
        departmentId: 'dept-123',
      });
      expect(unitId).toBe('dept-123');
    });

    it('S2: rejects if DepartmentID points to a Business Unit (type mismatch) with 400 SCOPE_ORG_UNIT_INVALID', async () => {
      // Unit exists and is active, but is of type 2 (BUSINESS_UNIT) instead of 3 (DEPARTMENT)
      mockDataSource.query.mockResolvedValueOnce([
        { OrgUnitId: 'unit-1', OrgUnitTypeId: 2, IsActive: 1, IsDeleted: 0 },
      ]);

      await expect(
        service.validateS2_ScopeOrgUnitType(SCOPE_CODES.DEPARTMENT, 'unit-1'),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.SCOPE_ORG_UNIT_INVALID,
          }),
        }),
      );
    });

    it('S2: rejects if referenced org unit is inactive or deleted with 400 SCOPE_ORG_UNIT_INVALID', async () => {
      // Unit is deleted
      mockDataSource.query.mockResolvedValueOnce([
        { OrgUnitId: 'unit-2', OrgUnitTypeId: 3, IsActive: 1, IsDeleted: 1 },
      ]);

      await expect(
        service.validateS2_ScopeOrgUnitType(SCOPE_CODES.DEPARTMENT, 'unit-2'),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.SCOPE_ORG_UNIT_INVALID,
          }),
        }),
      );
    });

    it('S2: succeeds when referenced org unit exists, is active, and matches type', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        {
          OrgUnitId: 'dept-valid',
          OrgUnitTypeId: 3,
          IsActive: 1,
          IsDeleted: 0,
        },
      ]);

      await expect(
        service.validateS2_ScopeOrgUnitType(
          SCOPE_CODES.DEPARTMENT,
          'dept-valid',
        ),
      ).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // 3. SECTION 5.1 CREATION RULES (U1 – U10)
  // ===========================================================================
  describe('3. Section 5.1 Creation Rules', () => {
    it('U1: rejects duplicate email (including soft deleted) with 409 USER_EMAIL_EXISTS', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        { userId: 'existing-user-uuid' },
      ]);

      await expect(
        service.validateU1_EmailUnique('tariq@diez.ae'),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.CONFLICT,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.USER_EMAIL_EXISTS,
          }),
        }),
      );
    });

    it('U2: rejects duplicate username with 409 USER_USERNAME_EXISTS', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        { userId: 'existing-user-uuid' },
      ]);

      await expect(
        service.validateU2_UsernameUnique('tariq.hashimi'),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.CONFLICT,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.USER_USERNAME_EXISTS,
          }),
        }),
      );
    });

    it('U3: rejects invalid user type with 400 USER_TYPE_INVALID', async () => {
      await expect(service.validateU3_UserType('CONTRACTOR')).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.USER_TYPE_INVALID,
          }),
        }),
      );
    });

    it('U4: rejects INTERNAL user without EmployeeID with 400 USER_EMPLOYEE_ID_REQUIRED', () => {
      expect(() => {
        service.validateU4_InternalUserEmployeeId(USER_TYPES.INTERNAL, '');
      }).toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.USER_EMPLOYEE_ID_REQUIRED,
          }),
        }),
      );
    });

    it('U5: rejects VENDOR user with internal EmployeeID with 400 USER_VENDOR_INVALID', () => {
      expect(() => {
        service.validateU5_VendorUserConstraints(
          USER_TYPES.VENDOR,
          'EMP-100',
          'vendor-uuid',
        );
      }).toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.USER_VENDOR_INVALID,
          }),
        }),
      );
    });

    it('U5: rejects VENDOR user without VendorID with 400 USER_VENDOR_INVALID', () => {
      expect(() => {
        service.validateU5_VendorUserConstraints(USER_TYPES.VENDOR, null, '');
      }).toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.USER_VENDOR_INVALID,
          }),
        }),
      );
    });

    it('U7: rejects if profile DepartmentID is inactive or mismatched with 400 USER_ORG_UNIT_INVALID', async () => {
      // Return inactive department
      mockDataSource.query.mockResolvedValueOnce([
        { OrgUnitId: 'dept-1', OrgUnitTypeId: 3, IsActive: 0, IsDeleted: 0 },
      ]);

      await expect(
        service.validateU7_OrgUnitReferences({ departmentId: 'dept-1' }),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.USER_ORG_UNIT_INVALID,
          }),
        }),
      );
    });

    it('U8: rejects creating user in department outside creator scope with 403 USER_SCOPE_DENIED', async () => {
      // Creator does not hold global scope
      mockDataSource.query.mockResolvedValueOnce([]);
      // Visible subtree does not include target department
      mockDataSource.query.mockResolvedValueOnce([]);

      await expect(
        service.validateU8_CreatorScopeCoversDepartment(
          operatorUserId,
          'dept-outside-uuid',
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.FORBIDDEN,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.USER_SCOPE_DENIED,
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // 4. SECTION 7 VENDOR USER RULES (V1, V2, V5)
  // ===========================================================================
  describe('4. Section 7 Vendor User Rules', () => {
    it('V1: rejects non-vendor user type on vendor endpoints with 400 USER_TYPE_INVALID', () => {
      expect(() => {
        service.validateV1_VendorUserType(USER_TYPES.INTERNAL);
      }).toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.USER_TYPE_INVALID,
          }),
        }),
      );
    });

    it('V2: rejects missing vendor ID with 400 VENDOR_REQUIRED', () => {
      expect(() => {
        service.validateV2_VendorLink('');
      }).toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.VENDOR_REQUIRED,
          }),
        }),
      );
    });

    it('V5: rejects vendor user with internal org unit on profile with 400 VENDOR_ORG_UNIT_NOT_ALLOWED', () => {
      expect(() => {
        service.validateV5_VendorOrgUnitProfile(USER_TYPES.VENDOR, {
          departmentId: 'dept-123',
        });
      }).toThrow(
        expect.objectContaining({
          status: HttpStatus.BAD_REQUEST,
          response: expect.objectContaining({
            code: USER_ERROR_CODES.VENDOR_ORG_UNIT_NOT_ALLOWED,
          }),
        }),
      );
    });
  });
});
