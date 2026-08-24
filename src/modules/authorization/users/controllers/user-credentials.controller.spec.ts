import { Test, TestingModule } from '@nestjs/testing';
import { UserCredentialsController } from './user-credentials.controller';
import { UserCredentialsService } from '../services/user-credentials.service';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';

describe('UserCredentialsController (Domain 3, §§5.2, 5.3, 5.4, 8)', () => {
  let controller: UserCredentialsController;
  let service: UserCredentialsService;

  const mockService = {
    inviteUser: jest.fn(),
    resetPassword: jest.fn(),
    unlockUser: jest.fn(),
    validateInvitationToken: jest.fn(),
    acceptInvitation: jest.fn(),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const currentUser = {
    userId: '2053433E-F36B-1410-85ED-009A959FB233',
    username: 'admin.user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserCredentialsController],
      providers: [{ provide: UserCredentialsService, useValue: mockService }],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserCredentialsController>(UserCredentialsController);
    service = module.get<UserCredentialsService>(UserCredentialsService);

    jest.clearAllMocks();
  });

  it('POST /authorization/users/:id/invite -> delegates to service.inviteUser', async () => {
    mockService.inviteUser.mockResolvedValueOnce({ success: true, message: 'Invitation issued' });

    const result = await controller.inviteUser(sampleUserId, { resend: true }, currentUser as any);
    expect(service.inviteUser).toHaveBeenCalledWith(sampleUserId, true, currentUser.userId);
    expect(result.success).toBe(true);
  });

  it('POST /authorization/users/:id/reset-password -> delegates to service.resetPassword', async () => {
    mockService.resetPassword.mockResolvedValueOnce({ success: true, message: 'Reset sent' });

    const result = await controller.resetPassword(sampleUserId, currentUser as any);
    expect(service.resetPassword).toHaveBeenCalledWith(sampleUserId, currentUser.userId);
    expect(result.success).toBe(true);
  });

  it('POST /authorization/users/:id/unlock -> delegates to service.unlockUser', async () => {
    mockService.unlockUser.mockResolvedValueOnce({ success: true, message: 'Unlocked' });

    const result = await controller.unlockUser(sampleUserId, currentUser as any);
    expect(service.unlockUser).toHaveBeenCalledWith(sampleUserId, currentUser.userId);
    expect(result.success).toBe(true);
  });

  it('POST /authorization/invitations/:token/validate -> delegates to service.validateInvitationToken', async () => {
    mockService.validateInvitationToken.mockResolvedValueOnce({ valid: true, purpose: 'INVITE' });

    const result = await controller.validateInvitation('valid-token');
    expect(service.validateInvitationToken).toHaveBeenCalledWith('valid-token');
    expect(result.valid).toBe(true);
  });

  it('POST /authorization/invitations/:token/accept -> delegates to service.acceptInvitation', async () => {
    mockService.acceptInvitation.mockResolvedValueOnce({ success: true, message: 'Accepted' });

    const result = await controller.acceptInvitation('valid-token', { password: 'StrongP@ssw0rd!' });
    expect(service.acceptInvitation).toHaveBeenCalledWith('valid-token', { password: 'StrongP@ssw0rd!' });
    expect(result.success).toBe(true);
  });
});
