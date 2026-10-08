import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateGradeDto {
  @ApiProperty({
    example: 'G01',
    description: 'Unique grade code',
  })
  @IsString()
  @IsNotEmpty({
    message: 'gradeCode is required',
  })
  gradeCode!: string;

  @ApiPropertyOptional({
    example: 'Senior Grade',
    description: 'Grade details',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  gradeDetails?: string | null;

  @ApiPropertyOptional({
    example: 8000,
    description: 'Minimum salary for the grade',
    nullable: true,
  })
  @IsOptional()
  @IsNumber(
    {
      maxDecimalPlaces: 2,
    },
    {
      message: 'minSalary must be a valid number',
    },
  )
  @Min(0, {
    message: 'minSalary cannot be negative',
  })
  minSalary?: number | null;

  @ApiPropertyOptional({
    example: 12000,
    description: 'Maximum salary for the grade',
    nullable: true,
  })
  @IsOptional()
  @IsNumber(
    {
      maxDecimalPlaces: 2,
    },
    {
      message: 'maxSalary must be a valid number',
    },
  )
  @Min(0, {
    message: 'maxSalary cannot be negative',
  })
  maxSalary?: number | null;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether the grade is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}