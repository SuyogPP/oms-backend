import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateDependencyTierDto {
  @ApiPropertyOptional({
    example: 'TIER02',
    description: 'Dependency tier code',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10, {
    message: 'tierCode must not exceed 10 characters',
  })
  tierCode?: string;

  @ApiPropertyOptional({
    example: 'Updated dependency tier description',
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
    example: false,
    description: 'Whether the dependency tier is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}