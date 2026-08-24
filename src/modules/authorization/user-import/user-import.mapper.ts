import {
  IImportValidationResult,
  IImportCommitResult,
} from './interfaces/user-import.interface';
import {
  ImportValidationResponseEntity,
  ImportCommitResponseEntity,
} from './entities/user-import.entity';

export class UserImportMapper {
  static toValidationEntity(
    model: IImportValidationResult,
  ): ImportValidationResponseEntity {
    return { ...model };
  }

  static toCommitEntity(
    model: IImportCommitResult,
  ): ImportCommitResponseEntity {
    return { ...model };
  }
}
