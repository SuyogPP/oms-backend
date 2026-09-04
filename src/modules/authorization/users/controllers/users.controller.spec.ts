import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from '../services/users.service';
import { UserLifecycleService } from '../services/user-lifecycle.service';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { USER_TYPES } from '../users.constants';

describe('UsersController (Domain 3, Section 8)', () => {
  let controller: UsersController;
  let usersService: UsersService;
  let userLifecycleService: UserLifecycleService;

  const mockUsersService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    exportUsers: jest.fn(),
    getUserActivity: jest.fn(),
  };

  const mockUserLifecycleService = {
    activate: jest.fn(),
    deactivate: jest.fn(),
    softDelete: jest.fn(),
  };

  const sampleUserId = '1053433E-F36B-1410-85ED-009A959FB122';
  const currentUser = {
    userId: '2053433E-F36B-1410-85ED-009A959FB233',
    username: 'admin.user',
    userType: 'INTERNAL',
    email: 'admin@diez.ae',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: UserLifecycleService, useValue: mockUserLifecycleService },
      ],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
    userLifecycleService =
      module.get<UserLifecycleService>(UserLifecycleService);

    jest.clearAllMocks();
  });

  it('GET /authorization/users -> delegates to usersService.findAll', async () => {
    const filter = { page: 1, limit: 20, status: 'ACTIVE' as const };
    mockUsersService.findAll.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    const result = await controller.findAll(filter as any, currentUser as any);
    expect(usersService.findAll).toHaveBeenCalledWith(
      filter,
      currentUser.userId,
    );
    expect(result.total).toBe(0);
  });

  it('GET /authorization/users/export -> delegates to usersService.exportUsers', async () => {
    const filter = { search: 'test' };
    mockUsersService.exportUsers.mockResolvedValueOnce([]);

    const result = await controller.exportUsers(
      filter as any,
      currentUser as any,
    );
    expect(usersService.exportUsers).toHaveBeenCalledWith(
      filter,
      currentUser.userId,
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it('GET /authorization/users/:id -> delegates to usersService.findById', async () => {
    mockUsersService.findById.mockResolvedValueOnce({
      userId: sampleUserId,
      username: 'tariq',
    });

    const result = await controller.findById(sampleUserId, currentUser as any);
    expect(usersService.findById).toHaveBeenCalledWith(
      sampleUserId,
      currentUser.userId,
    );
    expect(result.userId).toBe(sampleUserId);
  });

  it('POST /authorization/users -> delegates to usersService.create', async () => {
    const dto = {
      username: 'new.user',
      email: 'new@diez.ae',
      userType: USER_TYPES.INTERNAL,
      profile: { firstName: 'New', lastName: 'User' },
    };
    mockUsersService.create.mockResolvedValueOnce({
      user: { userId: sampleUserId },
    });

    const result = await controller.create(dto, currentUser as any);
    expect(usersService.create).toHaveBeenCalledWith(dto, currentUser.userId);
    expect(result.user.userId).toBe(sampleUserId);
  });

  it('PATCH /authorization/users/:id -> delegates to usersService.update', async () => {
    const dto = { email: 'updated@diez.ae' };
    mockUsersService.update.mockResolvedValueOnce({
      userId: sampleUserId,
      email: 'updated@diez.ae',
    });

    const result = await controller.update(
      sampleUserId,
      dto,
      currentUser as any,
    );
    expect(usersService.update).toHaveBeenCalledWith(
      sampleUserId,
      dto,
      currentUser.userId,
    );
    expect(result.email).toBe('updated@diez.ae');
  });

  it('POST /authorization/users/:id/activate -> delegates to userLifecycleService.activate', async () => {
    mockUserLifecycleService.activate.mockResolvedValueOnce(undefined);

    const result = await controller.activate(sampleUserId, currentUser as any);
    expect(userLifecycleService.activate).toHaveBeenCalledWith(
      sampleUserId,
      currentUser.userId,
    );
    expect(result.success).toBe(true);
  });

  it('POST /authorization/users/:id/deactivate -> delegates to userLifecycleService.deactivate', async () => {
    mockUserLifecycleService.deactivate.mockResolvedValueOnce(undefined);

    const result = await controller.deactivate(
      sampleUserId,
      currentUser as any,
    );
    expect(userLifecycleService.deactivate).toHaveBeenCalledWith(
      sampleUserId,
      currentUser.userId,
    );
    expect(result.success).toBe(true);
  });

  it('DELETE /authorization/users/:id -> delegates to userLifecycleService.softDelete', async () => {
    mockUserLifecycleService.softDelete.mockResolvedValueOnce(undefined);

    const result = await controller.delete(sampleUserId, currentUser as any);
    expect(userLifecycleService.softDelete).toHaveBeenCalledWith(
      sampleUserId,
      currentUser.userId,
    );
    expect(result.success).toBe(true);
  });

  it('GET /authorization/users/:id/activity -> delegates to usersService.getUserActivity', async () => {
    mockUsersService.getUserActivity.mockResolvedValueOnce([]);

    const result = await controller.getActivity(
      sampleUserId,
      currentUser as any,
    );
    expect(usersService.getUserActivity).toHaveBeenCalledWith(
      sampleUserId,
      currentUser.userId,
    );
    expect(Array.isArray(result)).toBe(true);
  });
});
