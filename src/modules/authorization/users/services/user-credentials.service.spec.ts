import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { UserCredentialsService } from './user-credentials.service';
import { UsersRepository } from '../repositories/users.repository';
import { UserInvitationsRepository } from '../repositories/user-invitations.repository';
import { PasswordHistoryRepository } from '../repositories/password-history.repository';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { USER_ERROR_CODES, INVITATION_PURPOSES } from '../users.constants';

describe('UserCredentialsService (Domain 3, §§5.2, 5.3, 5.4)', () => {
  let service: UserCredentialsService;
  let usersRepository: UsersRepository;
  let userInvitationsRepository: UserInvitationsRepository;
  let passwordHistoryRepository: PasswordHistoryRepository;
  let securityEventsService: SecurityEventsService;

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  const mockUsersRepository = {
    findById: jest.fn(),
    upsertLocalCredentials: jest.fn(),
    setMustChangePassword: jest.fn(),
    recordLogoutHistoryForSessions: jest.fn(),
    revokeAllUserSessions: jest.fn(),
    activate: jest.fn(),
    unlock: jest.fn(),
  };

  const mockUserInvitationsRepository = {
    create: jest.fn(),
    revokeOutstanding: jest.fn(),
    markConsumed: jest.fn(),
    findByTokenHashWithUser: jest.fn(),
  };

  const mockPasswordHistoryRepository = {
    add: jest.fn(),
    getRecent: jest.fn(),
    prune: jest.fn(),
  };

  const mockSecurityEventsService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logUserCreated: jest.fn().mockResolvedValue(undefined),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const operatorUserId = '2053433E-F36B-1410-85ED-009A959FB233';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserCredentialsService,
        { provide: UsersRepository, useValue: mockUsersRepository },
        { provide: UserInvitationsRepository, useValue: mockUserInvitationsRepository },
        { provide: PasswordHistoryRepository, useValue: mockPasswordHistoryRepository },
        { provide: SecurityEventsService, useValue: mockSecurityEventsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserCredentialsService>(UserCredentialsService);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    userInvitationsRepository = module.get<UserInvitationsRepository>(UserInvitationsRepository);
    passwordHistoryRepository = module.get<PasswordHistoryRepository>(PasswordHistoryRepository);
    securityEventsService = module.get<SecurityEventsService>(SecurityEventsService);

    jest.clearAllMocks();
  });

  describe('1. inviteUser (§5.2)', () => {
    it('generates 32-byte base64url token, persists only SHA-256 hash, and revokes outstanding tokens', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'tariq.hashimi',
        isActive: false,
        isDeleted: false,
      });

      const result = await service.inviteUser(sampleUserId, true, operatorUserId);

      expect(result.success).toBe(true);
      expect(result.rawToken).toBeDefined();
      expect(typeof result.rawToken).toBe('string');
      expect(result.expiresAt).toBeDefined();

      // Revokes outstanding unconsumed tokens
      expect(mockUserInvitationsRepository.revokeOutstanding).toHaveBeenCalledWith(
        sampleUserId,
        INVITATION_PURPOSES.INVITE,
        mockQueryRunner,
      );

      // Stores SHA-256 hash (64 hex characters), NEVER the raw token
      expect(mockUserInvitationsRepository.create).toHaveBeenCalledWith(
        sampleUserId,
        expect.stringMatching(/^[a-f0-9]{64}$/),
        INVITATION_PURPOSES.INVITE,
        expect.any(Date),
        operatorUserId,
        mockQueryRunner,
      );

      // Raw token is NEVER logged in security event
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith(
        'INVITATION_SENT',
        expect.objectContaining({
          userId: sampleUserId,
        }),
      );
      const loggedDesc = (mockSecurityEventsService.log as jest.Mock).mock.calls[0][1].description;
      expect(loggedDesc).not.toContain(result.rawToken);
    });

    it('rejects inviting an already active user when resend is false', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'tariq.hashimi',
        isActive: true,
        isDeleted: false,
      });

      await expect(service.inviteUser(sampleUserId, false, operatorUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('2. validateInvitationToken (Generic Error Invariance & Enumeration Defense)', () => {
    it('throws generic error when token does not exist', async () => {
      mockUserInvitationsRepository.findByTokenHashWithUser.mockResolvedValueOnce(null);

      await expect(service.validateInvitationToken('invalid-raw-token')).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: USER_ERROR_CODES.INVITATION_INVALID_OR_EXPIRED,
            message: 'This link is no longer valid. Ask an administrator to send a new invitation.',
          }),
        }),
      );
    });

    it('throws IDENTICAL generic error when token is expired', async () => {
      mockUserInvitationsRepository.findByTokenHashWithUser.mockResolvedValueOnce({
        invitation: {
          invitationId: 'inv-1',
          userId: sampleUserId,
          purpose: 'INVITE',
          expiresAt: new Date(Date.now() - 10000), // Expired
          consumedAt: null,
        },
        user: { userId: sampleUserId, username: 'tariq', email: 't@diez.ae', isDeleted: false },
      });

      await expect(service.validateInvitationToken('expired-raw-token')).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: USER_ERROR_CODES.INVITATION_INVALID_OR_EXPIRED,
            message: 'This link is no longer valid. Ask an administrator to send a new invitation.',
          }),
        }),
      );
    });

    it('throws IDENTICAL generic error when token is already consumed', async () => {
      mockUserInvitationsRepository.findByTokenHashWithUser.mockResolvedValueOnce({
        invitation: {
          invitationId: 'inv-1',
          userId: sampleUserId,
          purpose: 'INVITE',
          expiresAt: new Date(Date.now() + 100000),
          consumedAt: new Date(), // Already consumed
        },
        user: { userId: sampleUserId, username: 'tariq', email: 't@diez.ae', isDeleted: false },
      });

      await expect(service.validateInvitationToken('consumed-raw-token')).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: USER_ERROR_CODES.INVITATION_INVALID_OR_EXPIRED,
            message: 'This link is no longer valid. Ask an administrator to send a new invitation.',
          }),
        }),
      );
    });

    it('returns user context when token is valid', async () => {
      mockUserInvitationsRepository.findByTokenHashWithUser.mockResolvedValueOnce({
        invitation: {
          invitationId: 'inv-valid',
          userId: sampleUserId,
          purpose: 'INVITE',
          expiresAt: new Date(Date.now() + 100000),
          consumedAt: null,
        },
        user: { userId: sampleUserId, username: 'tariq.hashimi', email: 'tariq@diez.ae', isDeleted: false },
      });

      const response = await service.validateInvitationToken('valid-raw-token');
      expect(response.valid).toBe(true);
      expect(response.username).toBe('tariq.hashimi');
      expect(response.email).toBe('tariq@diez.ae');
    });
  });

  describe('3. acceptInvitation (Password History & Transactional Onboarding §5.2, §5.3)', () => {
    it('rejects password if it matches any of the last 5 passwords in history with 400 PASSWORD_HISTORY_VIOLATION', async () => {
      const oldPasswordHash = await bcrypt.hash('OldP@ssword123!', 10);

      mockUserInvitationsRepository.findByTokenHashWithUser.mockResolvedValueOnce({
        invitation: {
          invitationId: 'inv-1',
          userId: sampleUserId,
          purpose: 'INVITE',
          expiresAt: new Date(Date.now() + 100000),
          consumedAt: null,
        },
        user: { userId: sampleUserId, username: 'tariq', email: 't@diez.ae', isDeleted: false },
      });

      // User has previous history containing OldP@ssword123!
      mockPasswordHistoryRepository.getRecent.mockResolvedValueOnce([
        { passwordHistoryId: 'ph-1', userId: sampleUserId, passwordHash: oldPasswordHash, changedAt: new Date() },
      ]);

      await expect(
        service.acceptInvitation('raw-token', { password: 'OldP@ssword123!' }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            code: USER_ERROR_CODES.PASSWORD_HISTORY_VIOLATION,
          }),
        }),
      );
    });

    it('completes transactional onboarding: upserts credentials, records history, consumes token, activates user', async () => {
      mockUserInvitationsRepository.findByTokenHashWithUser.mockResolvedValueOnce({
        invitation: {
          invitationId: 'inv-1',
          userId: sampleUserId,
          purpose: 'INVITE',
          expiresAt: new Date(Date.now() + 100000),
          consumedAt: null,
        },
        user: { userId: sampleUserId, username: 'tariq', email: 't@diez.ae', isDeleted: false },
      });

      mockPasswordHistoryRepository.getRecent.mockResolvedValueOnce([]); // No prior history

      const response = await service.acceptInvitation('raw-token', { password: 'BrandNewP@ssw0rd!' });

      expect(response.success).toBe(true);

      // LocalCredentials upserted
      expect(mockUsersRepository.upsertLocalCredentials).toHaveBeenCalledWith(
        sampleUserId,
        expect.any(String),
        false,
        mockQueryRunner,
      );

      // PasswordHistory added and pruned
      expect(mockPasswordHistoryRepository.add).toHaveBeenCalledWith(
        sampleUserId,
        expect.any(String),
        mockQueryRunner,
      );
      expect(mockPasswordHistoryRepository.prune).toHaveBeenCalledWith(
        sampleUserId,
        24,
        mockQueryRunner,
      );

      // Token consumed & user activated
      expect(mockUserInvitationsRepository.markConsumed).toHaveBeenCalledWith('inv-1', mockQueryRunner);
      expect(mockUsersRepository.activate).toHaveBeenCalledWith(sampleUserId, mockQueryRunner);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

      // Security event logged
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith('INVITATION_ACCEPTED', expect.any(Object));
    });
  });

  describe('4. resetPassword (Zero Admin Password Visibility & Session Teardown §5.3)', () => {
    it('initiates reset without password arguments, sets MustChangePassword=1, records LogoutHistory, and terminates sessions', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'tariq.hashimi',
        isActive: true,
        isDeleted: false,
      });

      const result = await service.resetPassword(sampleUserId, operatorUserId);

      expect(result.success).toBe(true);
      expect(result.rawToken).toBeDefined();

      // Revokes outstanding reset tokens
      expect(mockUserInvitationsRepository.revokeOutstanding).toHaveBeenCalledWith(
        sampleUserId,
        INVITATION_PURPOSES.PASSWORD_RESET,
        mockQueryRunner,
      );

      // Sets MustChangePassword = 1
      expect(mockUsersRepository.setMustChangePassword).toHaveBeenCalledWith(
        sampleUserId,
        true,
        mockQueryRunner,
      );

      // Records LogoutHistory with reason PASSWORD_RESET
      expect(mockUsersRepository.recordLogoutHistoryForSessions).toHaveBeenCalledWith(
        sampleUserId,
        'PASSWORD_RESET',
        mockQueryRunner,
      );

      // Revokes all active sessions
      expect(mockUsersRepository.revokeAllUserSessions).toHaveBeenCalledWith(
        sampleUserId,
        expect.any(String),
        mockQueryRunner,
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith('PASSWORD_RESET_REQUESTED', expect.any(Object));
    });
  });

  describe('5. unlockUser (§5.4)', () => {
    it('clears lockout state and logs security event', async () => {
      mockUsersRepository.findById.mockResolvedValueOnce({
        userId: sampleUserId,
        username: 'locked.user',
        isActive: true,
        isDeleted: false,
      });

      const response = await service.unlockUser(sampleUserId, operatorUserId);

      expect(response.success).toBe(true);
      expect(mockUsersRepository.unlock).toHaveBeenCalledWith(sampleUserId);
      expect(mockSecurityEventsService.log).toHaveBeenCalledWith('USER_UNLOCKED', expect.any(Object));
    });
  });
});
