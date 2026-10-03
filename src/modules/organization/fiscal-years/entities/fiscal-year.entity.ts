import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FiscalYearEntity {
  @ApiProperty({
    example: 'b1ffcd88-8b0a-3ef7-aa5c-5aa8ac270a00',
    description: 'Unique UUID of the fiscal year',
  })
  fiscalYearId: string;

  @ApiProperty({
    example: 'FY2026',
    description: 'Unique code for the fiscal year (max 10 chars)',
  })
  code: string;

  @ApiProperty({
    example: '2026-01-01',
    description: 'Fiscal year start date (YYYY-MM-DD)',
  })
  startDate: string;

  @ApiProperty({
    example: '2026-12-31',
    description: 'Fiscal year end date (YYYY-MM-DD)',
  })
  endDate: string;

  @ApiProperty({
    example: 'OPEN',
    enum: ['DRAFT', 'OPEN', 'FROZEN', 'CLOSED', 'INACTIVE'],
    description: 'Status of the fiscal year: DRAFT, OPEN, FROZEN, CLOSED, or INACTIVE',
  })
  status: string;

  @ApiPropertyOptional({
    example: 'FY2026_ORACLE_BUDGET',
    description: 'Oracle budget name mapping (max 100 chars)',
    nullable: true,
  })
  oracleBudgetName?: string | null;

  @ApiProperty({
    example: false,
    description: 'Soft deletion status flag (true = deleted, false = active)',
  })
  isDelete: boolean;

  @ApiPropertyOptional({ example: '2026-10-03' })
  createdDate?: string | null;

  @ApiPropertyOptional({ example: 'usr-123' })
  createdBy?: string | null;

  @ApiPropertyOptional({ example: '2026-10-03' })
  modifiedDate?: string | null;

  @ApiPropertyOptional({ example: 'usr-123' })
  modifiedBy?: string | null;

  @ApiPropertyOptional({ example: 'Attribute 1 value' })
  attr1?: string | null;

  @ApiPropertyOptional({ example: 'Attribute 2 value' })
  attr2?: string | null;

  @ApiPropertyOptional({ example: 'Attribute 3 value' })
  attr3?: string | null;

  @ApiPropertyOptional({ example: 'Attribute 4 value' })
  attr4?: string | null;

  @ApiPropertyOptional({ example: 'Attribute 5 value' })
  attr5?: string | null;
}
