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

export class CreateBenefitDto {
  @ApiProperty({
    example: 'Medical Insurance',
    description: 'Benefit name',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({
    message: 'benefitName is required',
  })
  @MaxLength(100, {
    message: 'benefitName must not exceed 100 characters',
  })
  benefitName!: string;

  @ApiPropertyOptional({
    example: 'Medical insurance coverage for eligible employees',
    description: 'Benefit description',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'benefitDescription must not exceed 255 characters',
  })
  benefitDescription?: string | null;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether the benefit is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}