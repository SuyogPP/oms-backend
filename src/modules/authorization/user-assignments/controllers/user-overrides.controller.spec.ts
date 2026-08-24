import { Test, TestingModule } from '@nestjs/testing';
import { UserOverridesController } from './user-overrides.controller';
import { UserOverridesService } from '../services/user-overrides.service';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';

describe('UserOverridesController (Domain 3, Section 8)', () => {
  let controller: UserOverridesController;
  let service: UserOverridesService;

  const mockService = {
    findByUserId: jest.fn(),
    createOverride: jest.fn(),
    revokeOverride: jest.fn(),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const permissionId = '3053433E-F36B-1410-85ED-009A959FB344';
  const overrideId = '4053433E-F36B-1410-85ED-009A959FB455';
  const currentUser = {
    userId: '2053433E-F36B-1410-85ED-009A959FB233',
    username: 'admin.user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserOverridesController],
      providers: [{ provide: UserOverridesService, useValue: mockService }],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserOverridesController>(UserOverridesController);
    service = module.get<UserOverridesService>(UserOverridesService);

    jest.clearAllMocks();
  });

  it('GET /authorization/users/:id/overrides -> delegates to service.findByUserId', async () => {
    mockService.findByUserId.mockResolvedValueOnce([]);

    const result = await controller.findByUserId(sampleUserId, currentUser as any);
    expect(service.findByUserId).toHaveBeenCalledWith(sampleUserId, currentUser.userId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('POST /authorization/users/:id/overrides -> delegates to service.createOverride', async () => {
    const dto = {
      permissionId,
      isGranted: true,
      reason: 'Audit authorization',
    };
    mockService.createOverride.mockResolvedValueOnce({ userPermissionOverrideId: overrideId });

    const result = await controller.createOverride(sampleUserId, dto as any, currentUser as any);
    expect(service.createOverride).toHaveBeenCalledWith(sampleUserId, dto, currentUser.userId);
    expect(result.userPermissionOverrideId).toBe(overrideId);
  });

  it('DELETE /authorization/users/:id/overrides/:overrideId -> delegates to service.revokeOverride', async () => {
    mockService.revokeOverride.mockResolvedValueOnce(undefined);

    const result = await controller.revokeOverride(overrideId, currentUser as any);
    expect(service.revokeOverride).toHaveBeenCalledWith(overrideId, currentUser.userId);
    expect(result.success).toBe(true);
  });
});
