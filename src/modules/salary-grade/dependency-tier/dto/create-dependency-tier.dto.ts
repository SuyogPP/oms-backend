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

export class CreateDependencyTierDto {
  @ApiProperty({
    example: 'TIER01',
    description: 'Unique dependency tier code',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty({
    message: 'tierCode is required',
  })
  @MaxLength(10, {
    message: 'tierCode must not exceed 10 characters',
  })
  tierCode!: string;

  @ApiPropertyOptional({
    example: 'Spouse and children dependency tier',
    description: 'Dependency tier description',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'description must not exceed 255 characters',
  })
  description?: string | null;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether the dependency tier is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}