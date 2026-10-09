import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    example: 'CAT02',
    description: 'Category code',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10, {
    message:
      'categoryCode must not exceed 10 characters',
  })
  categoryCode?: string;

  @ApiPropertyOptional({
    example: 'Updated Management Category',
    description: 'Category details',
    maxLength: 100,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message:
      'categoryDetails must not exceed 100 characters',
  })
  categoryDetails?: string | null;

  @ApiPropertyOptional({
    example: false,
    description:
      'Whether the category is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}