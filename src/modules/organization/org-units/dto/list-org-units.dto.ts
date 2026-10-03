import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsBoolean,
} from 'class-validator';

export class ListOrgUnitsDto {
  @ApiPropertyOptional({ description: 'Filter by org unit type ID' })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  unitTypeId?: number;

  @ApiPropertyOptional({ description: 'Filter by parent unit ID' })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  parentId?: number;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Search term for Code or Name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  pageSize?: number = 20;
}
