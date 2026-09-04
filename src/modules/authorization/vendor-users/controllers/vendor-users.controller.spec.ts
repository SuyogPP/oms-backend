import { Test, TestingModule } from '@nestjs/testing';
import { VendorUsersController } from './vendor-users.controller';
import { VendorUsersService } from '../services/vendor-users.service';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';

describe('VendorUsersController (Domain 3, Section 8)', () => {
  let controller: VendorUsersController;
  let service: VendorUsersService;

  const mockService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    deactivateAllByVendorId: jest.fn(),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const vendorId = '2053433E-F36B-1410-85ED-009A959FB233';
  const currentUser = {
    userId: '3053433E-F36B-1410-85ED-009A959FB344',
    username: 'procurement.officer',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorUsersController],
      providers: [{ provide: VendorUsersService, useValue: mockService }],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<VendorUsersController>(VendorUsersController);
    service = module.get<VendorUsersService>(VendorUsersService);

    jest.clearAllMocks();
  });

  it('GET /authorization/vendor-users -> delegates to service.findAll', async () => {
    mockService.findAll.mockResolvedValueOnce([]);

    const result = await controller.findAll(currentUser as any);
    expect(service.findAll).toHaveBeenCalledWith(currentUser.userId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('GET /authorization/vendor-users/:id -> delegates to service.findById', async () => {
    mockService.findById.mockResolvedValueOnce({ userId: sampleUserId });

    const result = await controller.findById(sampleUserId);
    expect(service.findById).toHaveBeenCalledWith(sampleUserId);
    expect(result.userId).toBe(sampleUserId);
  });

  it('POST /authorization/vendor-users -> delegates to service.create', async () => {
    const dto = {
      username: 'ahmed.vendor',
      email: 'ahmed@alnaboodah.ae',
      vendorId,
      firstName: 'Ahmed',
      lastName: 'Khan',
    };
    mockService.create.mockResolvedValueOnce({ userId: sampleUserId });

    const result = await controller.create(dto, currentUser as any);
    expect(service.create).toHaveBeenCalledWith(dto, currentUser.userId);
    expect(result.userId).toBe(sampleUserId);
  });

  it('PATCH /authorization/vendor-users/:id -> delegates to service.update', async () => {
    const dto = { firstName: 'Ahmed Updated' };
    mockService.update.mockResolvedValueOnce({ userId: sampleUserId });

    const result = await controller.update(
      sampleUserId,
      dto,
      currentUser as any,
    );
    expect(service.update).toHaveBeenCalledWith(
      sampleUserId,
      dto,
      currentUser.userId,
    );
    expect(result.userId).toBe(sampleUserId);
  });

  it('POST /authorization/vendor-users/:id/deactivate -> delegates to service.deactivate', async () => {
    mockService.deactivate.mockResolvedValueOnce(undefined);

    const result = await controller.deactivate(
      sampleUserId,
      currentUser as any,
    );
    expect(service.deactivate).toHaveBeenCalledWith(
      sampleUserId,
      currentUser.userId,
    );
    expect(result.success).toBe(true);
  });

  it('POST /authorization/vendor-users/vendors/:vendorId/deactivate -> delegates to service.deactivateAllByVendorId', async () => {
    mockService.deactivateAllByVendorId.mockResolvedValueOnce(undefined);

    const result = await controller.deactivateByVendor(
      vendorId,
      currentUser as any,
    );
    expect(service.deactivateAllByVendorId).toHaveBeenCalledWith(
      vendorId,
      currentUser.userId,
    );
    expect(result.success).toBe(true);
  });
});
