import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateDesignationDto {
  @ApiPropertyOptional({
    example: 'DES02',
    description: 'Designation code',
  })
  @IsOptional()
  @IsString()
  designationCode?: string;

  @ApiPropertyOptional({
    example: 'Operations Manager',
    description: 'Designation name',
  })
  @IsOptional()
  @IsString()
  designationName?: string;

  @ApiPropertyOptional({
    example: 'Updated designation summary',
    description: 'Designation summary',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  designationSummary?: string | null;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the designation is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}