import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'CAT01',
    description: 'Unique category code',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty({
    message: 'categoryCode is required',
  })
  @MaxLength(10, {
    message:
      'categoryCode must not exceed 10 characters',
  })
  categoryCode!: string;

  @ApiPropertyOptional({
    example: 'Management Category',
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
    example: true,
    default: true,
    description:
      'Whether the category is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}