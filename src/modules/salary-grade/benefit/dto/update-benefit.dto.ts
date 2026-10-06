import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateBenefitDto {
  @ApiPropertyOptional({
    example: 'Enhanced Medical Insurance',
    description: 'Benefit name',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'benefitName must not exceed 100 characters',
  })
  benefitName?: string;

  @ApiPropertyOptional({
    example: 'Updated medical insurance coverage',
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
    example: false,
    description: 'Whether the benefit is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}