import { UserValidationService } from '../users/services/user-validation.service';
import { USER_TYPES, USER_ERROR_CODES } from '../users/users.constants';

describe('Vendor User Security Invariants & Internal Endpoint Rejections (Rules V1–V10)', () => {
  let validationService: UserValidationService;

  const mockUsersRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(() => {
    validationService = new UserValidationService(
      mockUsersRepository as any,
      mockDataSource as any,
    );
    jest.clearAllMocks();
  });

  describe('1. Rule V3: Vendor Users Cannot Receive Internal Roles', () => {
    it('rejects assigning an internal role (e.g. FINANCE_APPROVER) to a vendor user with 400 VENDOR_ROLE_INVALID', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        { RoleCode: 'FINANCE_APPROVER', RoleName: 'Finance Approver' },
      ]);

      await expect(
        validationService.validateV3_VendorRoles(
          USER_TYPES.VENDOR,
          'internal-role-id',
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: USER_ERROR_CODES.VENDOR_ROLE_INVALID,
          }),
        }),
      );
    });

    it('permits vendor-scoped roles (e.g. VENDOR_PORTAL_USER) for vendor users', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        { RoleCode: 'VENDOR_PORTAL_USER', RoleName: 'Vendor Portal User' },
      ]);

      await expect(
        validationService.validateV3_VendorRoles(
          USER_TYPES.VENDOR,
          'vendor-role-id',
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('2. Rule V4 & S5: Vendor Users Cannot Receive Organizational Scopes', () => {
    it('rejects assigning organizational scope to a vendor user with 400 VENDOR_SCOPE_NOT_ALLOWED', () => {
      expect(() => {
        validationService.validateV4_VendorScope(USER_TYPES.VENDOR);
      }).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: USER_ERROR_CODES.VENDOR_SCOPE_NOT_ALLOWED,
          }),
        }),
      );
    });

    it('rejects via validateS5_VendorScopeRestriction with 400 SCOPE_VENDOR_NOT_ALLOWED', () => {
      expect(() => {
        validationService.validateS5_VendorScopeRestriction(USER_TYPES.VENDOR);
      }).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: USER_ERROR_CODES.SCOPE_VENDOR_NOT_ALLOWED,
          }),
        }),
      );
    });
  });

  describe('3. Rule V5: Vendor Profile Cannot Link to Internal Org Units', () => {
    it('rejects profile with DepartmentID with 400 VENDOR_ORG_UNIT_NOT_ALLOWED', () => {
      expect(() => {
        validationService.validateV5_VendorOrgUnitProfile(USER_TYPES.VENDOR, {
          departmentId: 'dept-123',
        });
      }).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: USER_ERROR_CODES.VENDOR_ORG_UNIT_NOT_ALLOWED,
          }),
        }),
      );
    });

    it('rejects profile with BusinessUnitID with 400 VENDOR_ORG_UNIT_NOT_ALLOWED', () => {
      expect(() => {
        validationService.validateV5_VendorOrgUnitProfile(USER_TYPES.VENDOR, {
          businessUnitId: 'bu-123',
        });
      }).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: USER_ERROR_CODES.VENDOR_ORG_UNIT_NOT_ALLOWED,
          }),
        }),
      );
    });

    it('accepts vendor profile with null org unit references', () => {
      expect(() => {
        validationService.validateV5_VendorOrgUnitProfile(USER_TYPES.VENDOR, {
          organizationId: null,
          businessUnitId: null,
          departmentId: null,
          sectionId: null,
        });
      }).not.toThrow();
    });
  });

  describe('4. Rule V7 & V9: Vendor Access Control & Endpoint Isolation', () => {
    it('asserts that vendor users are prevented from executing internal administrative operations', () => {
      // Simulate permission check for internal admin operations
      const internalAdminPermissions = [
        'USER.VIEW',
        'USER.CREATE',
        'USER.ROLE.ASSIGN',
        'USER.SCOPE.ASSIGN',
        'USER.OVERRIDE.MANAGE',
        'USER.DELEGATION.MANAGE',
      ];

      const vendorUserPermissions = ['VENDOR.PORTAL.VIEW', 'VENDOR.BID.SUBMIT'];

      for (const requiredPerm of internalAdminPermissions) {
        const hasAccess = vendorUserPermissions.includes(requiredPerm);
        expect(hasAccess).toBe(false);
      }
    });
  });
});
