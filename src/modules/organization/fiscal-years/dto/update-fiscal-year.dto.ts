import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateFiscalYearDto {
  @ApiPropertyOptional({
    example: 'b1ffcd88-8b0a-3ef7-aa5c-5aa8ac270a00',
    description: 'Fiscal Year ID to update (optional if provided in URL parameter)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'fiscalYearId must be a valid UUID v4 string' })
  fiscalYearId?: string;

  @ApiPropertyOptional({
    example: 'FY2026_MOD',
    description: 'Unique code for the fiscal year',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'code must not exceed 10 characters' })
  code?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Start date of fiscal year (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid date string (YYYY-MM-DD)' })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'End date of fiscal year (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid date string (YYYY-MM-DD)' })
  endDate?: string;

  @ApiPropertyOptional({
    example: 'OPEN',
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
    example: 'FY2026_ORACLE_BUDGET_UPDATED',
    description: 'Oracle budget name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'oracleBudgetName must not exceed 100 characters' })
  oracleBudgetName?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Soft deletion flag (true = deleted, false = active)',
  })
  @IsOptional()
  @IsBoolean()
  isDelete?: boolean;

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
