import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDesignationDto {
  @ApiProperty({
    example: 'DES01',
    description: 'Unique designation code',
  })
  @IsString()
  @IsNotEmpty({
    message: 'designationCode is required',
  })
  designationCode!: string;

  @ApiProperty({
    example: 'Senior Manager',
    description: 'Designation name',
  })
  @IsString()
  @IsNotEmpty({
    message: 'designationName is required',
  })
  designationName!: string;

  @ApiPropertyOptional({
    example: 'Senior management role',
    description: 'Designation summary',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  designationSummary?: string | null;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether the designation is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}