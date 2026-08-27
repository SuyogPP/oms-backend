import { Test, TestingModule } from '@nestjs/testing';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from '../services/delegations.service';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';

describe('DelegationsController (Domain 3, Section 8)', () => {
  let controller: DelegationsController;
  let service: DelegationsService;

  const mockService = {
    findMyDelegations: jest.fn(),
    findByUserId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  };

  const delegatorId = '1053433E-F36B-1410-85ED-009A959FB111';
  const delegateId = '2053433E-F36B-1410-85ED-009A959FB222';
  const delegationId = '4053433E-F36B-1410-85ED-009A959FB444';
  const currentUser = {
    userId: delegatorId,
    username: 'test.user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DelegationsController],
      providers: [{ provide: DelegationsService, useValue: mockService }],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DelegationsController>(DelegationsController);
    service = module.get<DelegationsService>(DelegationsService);

    jest.clearAllMocks();
  });

  it('GET /authorization/me/delegations -> delegates to service.findMyDelegations', async () => {
    mockService.findMyDelegations.mockResolvedValueOnce({ granted: [], received: [] });

    const result = await controller.getMyDelegations(currentUser as any);
    expect(service.findMyDelegations).toHaveBeenCalledWith(currentUser.userId);
    expect(result.granted).toEqual([]);
    expect(result.received).toEqual([]);
  });

  it('GET /authorization/users/:id/delegations -> delegates to service.findByUserId', async () => {
    mockService.findByUserId.mockResolvedValueOnce([]);

    const result = await controller.findByUserId(delegatorId, currentUser as any);
    expect(service.findByUserId).toHaveBeenCalledWith(delegatorId, currentUser.userId);
    expect(Array.isArray(result)).toBe(true);
  });

  it('POST /authorization/users/:id/delegations -> delegates to service.create', async () => {
    const dto = {
      toUserId: delegateId,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-15'),
      reason: 'Leave coverage',
    };
    mockService.create.mockResolvedValueOnce({ delegationId });

    const result = await controller.create(delegatorId, dto as any, currentUser as any);
    expect(service.create).toHaveBeenCalledWith(delegatorId, dto, currentUser.userId);
    expect(result.delegationId).toBe(delegationId);
  });

  it('PATCH /authorization/delegations/:id -> delegates to service.update', async () => {
    const dto = { reason: 'Updated reason' };
    mockService.update.mockResolvedValueOnce({ delegationId, reason: 'Updated reason' });

    const result = await controller.update(delegationId, dto as any, currentUser as any);
    expect(service.update).toHaveBeenCalledWith(delegationId, dto, currentUser.userId);
    expect(result.reason).toBe('Updated reason');
  });

  it('DELETE /authorization/delegations/:id -> delegates to service.cancel', async () => {
    mockService.cancel.mockResolvedValueOnce(undefined);

    const result = await controller.cancel(delegationId, currentUser as any);
    expect(service.cancel).toHaveBeenCalledWith(delegationId, currentUser.userId);
    expect(result.success).toBe(true);
  });
});
