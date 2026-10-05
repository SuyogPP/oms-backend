import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ListBudgetCategoriesDto {
  @ApiPropertyOptional({
    example: 'HARDWARE',
    description: 'Search string to filter by code or name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether to include soft-deleted / inactive categories',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
