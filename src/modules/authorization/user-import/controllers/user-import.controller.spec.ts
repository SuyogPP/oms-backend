import { Test, TestingModule } from '@nestjs/testing';
import { UserImportController } from './user-import.controller';
import { UserImportService } from '../services/user-import.service';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RateLimitGuard } from '../../../../common/rate-limit/rate-limit.guard';

describe('UserImportController (Domain 3, Section 8)', () => {
  let controller: UserImportController;
  let service: UserImportService;

  const mockService = {
    getTemplate: jest.fn(),
    validateImport: jest.fn(),
    commitImport: jest.fn(),
  };

  const currentUser = {
    userId: '3053433E-F36B-1410-85ED-009A959FB344',
    username: 'admin.user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserImportController],
      providers: [{ provide: UserImportService, useValue: mockService }],
    })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserImportController>(UserImportController);
    service = module.get<UserImportService>(UserImportService);

    jest.clearAllMocks();
  });

  it('GET /authorization/users/import/template -> returns CSV template stream', () => {
    mockService.getTemplate.mockReturnValueOnce('header1,header2\n');

    const res: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    controller.getTemplate(res);

    expect(service.getTemplate).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(res.send).toHaveBeenCalledWith('header1,header2\n');
  });

  it('POST /authorization/users/import/validate -> delegates to service.validateImport', async () => {
    const dto = { rows: [] };
    mockService.validateImport.mockResolvedValueOnce({
      importToken: 'imp_123',
    });

    const result = await controller.validateImport(dto, currentUser as any);
    expect(service.validateImport).toHaveBeenCalledWith(
      dto,
      currentUser.userId,
    );
    expect(result.importToken).toBe('imp_123');
  });

  it('POST /authorization/users/import/commit -> delegates to service.commitImport', async () => {
    const dto = { importToken: 'imp_123' };
    mockService.commitImport.mockResolvedValueOnce({ importedCount: 5 });

    const result = await controller.commitImport(dto, currentUser as any);
    expect(service.commitImport).toHaveBeenCalledWith(dto, currentUser.userId);
    expect(result.importedCount).toBe(5);
  });
});
