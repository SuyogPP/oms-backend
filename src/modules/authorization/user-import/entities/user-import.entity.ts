import { ApiProperty } from '@nestjs/swagger';
import {
  IImportValidationResult,
  IImportCommitResult,
  IRowValidationError,
} from '../interfaces/user-import.interface';

export class RowValidationErrorEntity implements IRowValidationError {
  @ApiProperty({ example: 4 })
  rowNumber!: number;

  @ApiProperty({ example: 'email' })
  field!: string;

  @ApiProperty({ example: 'USER_EMAIL_EXISTS' })
  errorCode!: string;

  @ApiProperty({ example: 'Email address already exists in the system' })
  message!: string;
}

export class ImportValidationResponseEntity implements IImportValidationResult {
  @ApiProperty({ example: 'imp_9f823a01bce44' })
  importToken!: string;

  @ApiProperty({ example: 50 })
  totalRows!: number;

  @ApiProperty({ example: 48 })
  validRows!: number;

  @ApiProperty({ example: 2 })
  invalidRows!: number;

  @ApiProperty({ type: [RowValidationErrorEntity] })
  errors!: RowValidationErrorEntity[];
}

export class ImportCommitResponseEntity implements IImportCommitResult {
  @ApiProperty({ example: 48 })
  importedCount!: number;

  @ApiProperty({ example: 0 })
  failedCount!: number;

  @ApiProperty({ example: ['1053433E-F36B-1410-85ED-009A959FB122'] })
  createdUserIds!: string[];
}
