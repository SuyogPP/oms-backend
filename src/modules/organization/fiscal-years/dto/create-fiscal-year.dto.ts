import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateBy,
} from 'class-validator';

export class CreateFiscalYearDto {
  @ApiProperty({
    example: 'FY2026',
    description: 'Unique code for the fiscal year (max 10 chars)',
  })
  @IsString()
  @IsNotEmpty({ message: 'code is required' })
  @MaxLength(10, { message: 'code must not exceed 10 characters' })
  code: string;

  @ApiProperty({
    example: '2026-01-01',
    description: 'Start date of fiscal year (YYYY-MM-DD)',
  })
  @IsDateString({}, { message: 'startDate must be a valid date string (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'startDate is required' })
  startDate: string;

  @ApiProperty({
    example: '2026-12-31',
    description: 'End date of fiscal year (YYYY-MM-DD)',
  })
  @IsDateString({}, { message: 'endDate must be a valid date string (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'endDate is required' })
  endDate: string;

  @ApiPropertyOptional({
    example: 'OPEN',
    default: 'OPEN',
    enum: ['DRAFT', 'OPEN', 'FROZEN', 'CLOSED', 'INACTIVE'],
    description: 'Status of fiscal year: DRAFT, OPEN, FROZEN, CLOSED, or INACTIVE',
  })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'OPEN', 'FROZEN', 'CLOSED', 'INACTIVE'], {
    message: 'status must be one of: DRAFT, OPEN, FROZEN, CLOSED, INACTIVE',
  })
  status?: string;

  @ApiPropertyOptional({
    example: 'FY2026_ORACLE_BUDGET',
    description: 'Oracle budget name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'oracleBudgetName must not exceed 100 characters' })
  oracleBudgetName?: string;

  @ApiProperty({
    example: '509d9f7b-d643-4564-a520-1f3c449607df',
    description: 'User ID or username creating this record (max 50 chars)',
  })
  // Single combined check so only one error message is returned per failure
  @ValidateBy({
    name: 'createdByRequired',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= 50,
      defaultMessage: (args) => {
        const value = args?.value;
        if (value === undefined || value === null || String(value).trim() === '') {
          return 'createdBy is required';
        }
        if (typeof value !== 'string') return 'createdBy must be a string';
        return 'createdBy must not exceed 50 characters';
      },
    },
  })
  createdBy: string;

  @ApiPropertyOptional({
    example: '509d9f7b-d643-4564-a520-1f3c449607df',
    description: 'User ID or username modifying this record (max 50 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'modifiedBy must not exceed 50 characters' })
  modifiedBy?: string;

  @ApiPropertyOptional({ example: 'Optional attribute 1' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  attr1?: string;

  @ApiPropertyOptional({ example: 'Optional attribute 2' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  attr2?: string;

  @ApiPropertyOptional({ example: 'Optional attribute 3' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  attr3?: string;

  @ApiPropertyOptional({ example: 'Optional attribute 4' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  attr4?: string;

  @ApiPropertyOptional({ example: 'Optional attribute 5' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  attr5?: string;
}
