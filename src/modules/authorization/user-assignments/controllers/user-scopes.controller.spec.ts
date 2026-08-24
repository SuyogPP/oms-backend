import { Test, TestingModule } from '@nestjs/testing';
import { UserScopesController } from './user-scopes.controller';
import { UserScopesService } from '../services/user-scopes.service';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';

describe('UserScopesController (Domain 3, Section 8)', () => {
  let controller: UserScopesController;
  let service: UserScopesService;

  const mockService = {
    findByUserId: jest.fn(),
    assignScope: jest.fn(),
    revokeScope: jest.fn(),
    countProposedScopeUnits: jest.fn(),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const scopeDefinitionId = '3053433E-F36B-1410-85ED-009A959FB344';
  const scopeId = '4053433E-F36B-1410-85ED-009A959FB455';
  const currentUser = {
    userId: '2053433E-F36B-1410-85ED-009A959FB233',
    username: 'admin.user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserScopesController],
      providers: [{ provide: UserScopesService, useValue: mockService }],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserScopesController>(UserScopesController);
    service = module.get<UserScopesService>(UserScopesService);

    jest.clearAllMocks();
  });

  it('GET /authorization/users/:id/scopes -> delegates to service.findByUserId', async () => {
    mockService.findByUserId.mockResolvedValueOnce([]);

    const result = await controller.findByUserId(sampleUserId, currentUser as any);
    expect(service.findByUserId).toHaveBeenCalledWith(sampleUserId, currentUser.userId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('POST /authorization/users/:id/scopes -> delegates to service.assignScope', async () => {
    const dto = { scopeDefinitionId };
    mockService.assignScope.mockResolvedValueOnce({ userOrganizationScopeId: scopeId });

    const result = await controller.assignScope(sampleUserId, dto as any, currentUser as any);
    expect(service.assignScope).toHaveBeenCalledWith(sampleUserId, dto, currentUser.userId);
    expect(result.userOrganizationScopeId).toBe(scopeId);
  });

  it('DELETE /authorization/users/:id/scopes/:scopeId -> delegates to service.revokeScope', async () => {
    mockService.revokeScope.mockResolvedValueOnce(undefined);

    const result = await controller.revokeScope(scopeId, currentUser as any);
    expect(service.revokeScope).toHaveBeenCalledWith(scopeId, currentUser.userId);
    expect(result.success).toBe(true);
  });

  it('GET /authorization/users/scopes/preview-coverage -> delegates to service.countProposedScopeUnits', async () => {
    mockService.countProposedScopeUnits.mockResolvedValueOnce({
      accessibleOrgUnitsCount: 10,
      scopeCode: 'DEPARTMENT',
    });

    const result = await controller.previewCoverage(scopeDefinitionId, 'dept-123');
    expect(service.countProposedScopeUnits).toHaveBeenCalledWith(scopeDefinitionId, 'dept-123');
    expect(result.accessibleOrgUnitsCount).toBe(10);
  });
});
