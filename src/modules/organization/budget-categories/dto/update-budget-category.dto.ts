import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateBudgetCategoryDto {
  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Budget Category ID to update (optional if provided in URL parameter)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'budgetCategoryId must be a valid UUID v4 string' })
  budgetCategoryId?: string;

  @ApiPropertyOptional({
    example: 'IT_HARDWARE_MOD',
    description: 'Unique code for the budget category',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'code must not exceed 20 characters' })
  code?: string;

  @ApiPropertyOptional({
    example: 'Updated IT Hardware & Software Equipment',
    description: 'Name of the budget category',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'name must not exceed 150 characters' })
  name?: string;

  @ApiPropertyOptional({
    example: 'OPEX',
    description: 'Expense type (e.g. CAPEX, OPEX)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'expenseType must not exceed 10 characters' })
  expenseType?: string;

  @ApiPropertyOptional({
    example: 'ORCL-ACC-2099',
    description: 'Oracle account code mapping',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'oracleAccountCode must not exceed 30 characters' })
  oracleAccountCode?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Is active status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
