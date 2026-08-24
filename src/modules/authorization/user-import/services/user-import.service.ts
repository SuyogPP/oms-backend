import { Injectable, NotImplementedException } from '@nestjs/common';
import { UserImportRepository } from '../repositories/user-import.repository';
import { ValidateImportDto, CommitImportDto } from '../dto/validate-import.dto';
import { IImportValidationResult, IImportCommitResult } from '../interfaces/user-import.interface';

@Injectable()
export class UserImportService {
  constructor(private readonly userImportRepository: UserImportRepository) {}

  async validateImport(dto: ValidateImportDto, operatorUserId?: string): Promise<IImportValidationResult> {
    throw new NotImplementedException('UserImportService.validateImport is not yet implemented');
  }

  async commitImport(dto: CommitImportDto, operatorUserId?: string): Promise<IImportCommitResult> {
    throw new NotImplementedException('UserImportService.commitImport is not yet implemented');
  }
}
