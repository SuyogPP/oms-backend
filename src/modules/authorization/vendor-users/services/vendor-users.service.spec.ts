import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VendorUsersService } from './vendor-users.service';
import { VendorUsersRepository } from '../repositories/vendor-users.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { UserValidationService } from '../../users/services/user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { USER_TYPES } from '../../users/users.constants';

describe('VendorUsersService (Domain 3, Section 7 Rules V1–V10)', () => {
  let service: VendorUsersService;
  let vendorUsersRepository: VendorUsersRepository;
  let validationService: UserValidationService;
  let securityEventsService: SecurityEventsService;
  let auditService: AuditService;

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockVendorUsersRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    deactivateAllByVendorId: jest.fn(),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
  };

  const mockValidationService = {
    validateV1_VendorUserType: jest.fn(),
    validateV2_VendorLink: jest.fn(),
    validateU1_EmailUnique: jest.fn().mockResolvedValue(undefined),
    validateU2_UsernameUnique: jest.fn().mockResolvedValue(undefined),
    validateV5_VendorOrgUnitProfile: jest.fn(),
  };

  const mockSecurityEventsService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logUserCreated: jest.fn().mockResolvedValue(undefined),
    logUserUpdated: jest.fn().mockResolvedValue(undefined),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const vendorId = '2053433E-F36B-1410-85ED-009A959FB233';
  const operatorUserId = '3053433E-F36B-1410-85ED-009A959FB344';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorUsersService,
        { provide: VendorUsersRepository, useValue: mockVendorUsersRepository },
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: UserValidationService, useValue: mockValidationService },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<VendorUsersService>(VendorUsersService);
    vendorUsersRepository = module.get<VendorUsersRepository>(VendorUsersRepository);
    validationService = module.get<UserValidationService>(UserValidationService);
    securityEventsService = module.get<SecurityEventsService>(SecurityEventsService);
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('1. findAll (V9: Isolated Listing)', () => {
    it('returns only vendor users isolated from internal staff', async () => {
      const vendorUsers = [
        {
          userId: sampleUserId,
          username: 'ahmed.vendor',
          email: 'ahmed@alnaboodah.ae',
          userType: USER_TYPES.VENDOR,
          vendorId,
          isActive: true,
        },
      ];
      mockVendorUsersRepository.findAll.mockResolvedValueOnce(vendorUsers);

      const result = await service.findAll();
      expect(result).toEqual(vendorUsers);
      expect(mockVendorUsersRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('2. create (Rules V1, V2, V5 Enforcement)', () => {
    const validDto = {
      username: 'ahmed.vendor',
      email: 'ahmed@alnaboodah.ae',
      vendorId,
      firstName: 'Ahmed',
      lastName: 'Khan',
      phoneNumber: '+971501112233',
      jobTitle: 'Account Manager',
    };

    it('creates vendor user with valid vendor UUID link and writes audit log', async () => {
      mockVendorUsersRepository.create.mockResolvedValueOnce(sampleUserId);
      mockVendorUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        ...validDto,
        userType: USER_TYPES.VENDOR,
        isActive: true,
      });

      const result = await service.create(validDto, operatorUserId);

      expect(mockValidationService.validateV1_VendorUserType).toHaveBeenCalledWith(USER_TYPES.VENDOR);
      expect(mockValidationService.validateV2_VendorLink).toHaveBeenCalledWith(vendorId);
      expect(mockValidationService.validateU1_EmailUnique).toHaveBeenCalledWith(validDto.email);
      expect(mockValidationService.validateU2_UsernameUnique).toHaveBeenCalledWith(validDto.username);
      expect(mockValidationService.validateV5_VendorOrgUnitProfile).toHaveBeenCalledWith(USER_TYPES.VENDOR, {});

      expect(mockVendorUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: validDto.username,
          email: validDto.email,
          vendorId: validDto.vendorId,
        }),
      );

      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'VENDOR_USER_CREATED',
        expect.objectContaining({ userId: sampleUserId }),
      );

      expect(mockAuditService.logUserCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sampleUserId,
          username: validDto.username,
          email: validDto.email,
        }),
      );

      expect(result.userId).toBe(sampleUserId);
    });

    it('V2: rejects invalid vendorId shape with 400 Bad Request', async () => {
      const invalidDto = {
        ...validDto,
        vendorId: 'not-a-valid-uuid',
      };

      await expect(service.create(invalidDto, operatorUserId)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockVendorUsersRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('3. update & deactivate', () => {
    it('updates vendor user details', async () => {
      mockVendorUsersRepository.findById
        .mockResolvedValueOnce({
          userId: sampleUserId,
          username: 'ahmed.vendor',
          email: 'old@alnaboodah.ae',
        })
        .mockResolvedValueOnce({
          userId: sampleUserId,
          username: 'ahmed.vendor',
          email: 'new@alnaboodah.ae',
        });

      const dto = { email: 'new@alnaboodah.ae', firstName: 'Ahmed Updated' };
      const result = await service.update(sampleUserId, dto, operatorUserId);

      expect(mockVendorUsersRepository.update).toHaveBeenCalledWith(
        sampleUserId,
        expect.objectContaining({ email: 'new@alnaboodah.ae' }),
      );
      expect(result.email).toBe('new@alnaboodah.ae');
    });

    it('deactivates vendor user account', async () => {
      mockVendorUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'ahmed.vendor',
      });

      await service.deactivate(sampleUserId, operatorUserId);

      expect(mockVendorUsersRepository.deactivate).toHaveBeenCalledWith(sampleUserId);
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'VENDOR_USER_DEACTIVATED',
        expect.objectContaining({ userId: sampleUserId }),
      );
    });
  });

  describe('4. deactivateAllByVendorId (Rule V10 Cascade)', () => {
    it('V10: deactivates all users associated with a deactivated vendor', async () => {
      await service.deactivateAllByVendorId(vendorId, operatorUserId);

      expect(mockVendorUsersRepository.deactivateAllByVendorId).toHaveBeenCalledWith(vendorId);
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'VENDOR_DEACTIVATED_CASCADE',
        expect.any(Object),
      );
    });

    it('rejects invalid vendorId UUID format with 400 Bad Request', async () => {
      await expect(
        service.deactivateAllByVendorId('invalid-uuid', operatorUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
