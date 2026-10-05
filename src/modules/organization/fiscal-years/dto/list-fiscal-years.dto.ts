import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ListFiscalYearsDto {
  @ApiPropertyOptional({
    example: 'FY2026',
    description: 'Search string to filter by code or status',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether to include INACTIVE / soft-deleted fiscal years',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
