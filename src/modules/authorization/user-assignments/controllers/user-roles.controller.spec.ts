import { Test, TestingModule } from '@nestjs/testing';
import { UserRolesController } from './user-roles.controller';
import { UserRolesService } from '../services/user-roles.service';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';

describe('UserRolesController (Domain 3, Section 8)', () => {
  let controller: UserRolesController;
  let service: UserRolesService;

  const mockService = {
    findByUserId: jest.fn(),
    assignRole: jest.fn(),
    revokeRole: jest.fn(),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const roleId = '3053433E-F36B-1410-85ED-009A959FB344';
  const userRoleId = '4053433E-F36B-1410-85ED-009A959FB455';
  const currentUser = {
    userId: '2053433E-F36B-1410-85ED-009A959FB233',
    username: 'admin.user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserRolesController],
      providers: [{ provide: UserRolesService, useValue: mockService }],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserRolesController>(UserRolesController);
    service = module.get<UserRolesService>(UserRolesService);

    jest.clearAllMocks();
  });

  it('GET /authorization/users/:id/roles -> delegates to service.findByUserId', async () => {
    mockService.findByUserId.mockResolvedValueOnce([]);

    const result = await controller.findByUserId(sampleUserId, currentUser as any);
    expect(service.findByUserId).toHaveBeenCalledWith(sampleUserId, currentUser.userId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('POST /authorization/users/:id/roles -> delegates to service.assignRole', async () => {
    const dto = { roleId };
    mockService.assignRole.mockResolvedValueOnce({ userRoleId, roleId });

    const result = await controller.assignRole(sampleUserId, dto, currentUser as any);
    expect(service.assignRole).toHaveBeenCalledWith(sampleUserId, dto, currentUser.userId);
    expect(result.userRoleId).toBe(userRoleId);
  });

  it('DELETE /authorization/users/:id/roles/:userRoleId -> delegates to service.revokeRole', async () => {
    mockService.revokeRole.mockResolvedValueOnce(undefined);

    const result = await controller.revokeRole(userRoleId, currentUser as any);
    expect(service.revokeRole).toHaveBeenCalledWith(userRoleId, currentUser.userId);
    expect(result.success).toBe(true);
  });
});
