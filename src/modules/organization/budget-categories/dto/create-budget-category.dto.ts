import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBudgetCategoryDto {
  @ApiProperty({
    example: 'IT_HARDWARE',
    description: 'Unique code for the budget category (max 20 chars)',
  })
  @IsString()
  @IsNotEmpty({ message: 'code is required' })
  @MaxLength(20, { message: 'code must not exceed 20 characters' })
  code: string;

  @ApiProperty({
    example: 'IT Hardware & Equipment',
    description: 'Name of the budget category (max 150 chars)',
  })
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(150, { message: 'name must not exceed 150 characters' })
  name: string;

  @ApiProperty({
    example: 'CAPEX',
    description: 'Expense type (e.g. CAPEX, OPEX) (max 10 chars)',
  })
  @IsString()
  @IsNotEmpty({ message: 'expenseType is required' })
  @MaxLength(10, { message: 'expenseType must not exceed 10 characters' })
  expenseType: string;

  @ApiPropertyOptional({
    example: 'ORCL-ACC-1092',
    description: 'Oracle account code mapping (max 30 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'oracleAccountCode must not exceed 30 characters' })
  oracleAccountCode?: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Is active status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
