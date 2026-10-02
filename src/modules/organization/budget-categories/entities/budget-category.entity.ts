import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BudgetCategoryEntity {
  @ApiProperty({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Unique UUID of the budget category',
  })
  budgetCategoryId: string;

  @ApiProperty({
    example: 'IT_HARDWARE',
    description: 'Unique code for the budget category (max 20 chars)',
  })
  code: string;

  @ApiProperty({
    example: 'IT Hardware & Equipment',
    description: 'Name of the budget category (max 150 chars)',
  })
  name: string;

  @ApiProperty({
    example: 'CAPEX',
    description: 'Expense type classification (e.g., CAPEX, OPEX) (max 10 chars)',
  })
  expenseType: string;

  @ApiPropertyOptional({
    example: 'ORCL-ACC-1092',
    description: 'Oracle account code mapping (max 30 chars)',
    nullable: true,
  })
  oracleAccountCode?: string | null;

  @ApiProperty({
    example: true,
    description: 'Indicates if the category is active (soft deletion status)',
  })
  isActive: boolean;
}
