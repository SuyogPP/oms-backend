import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateGradeDto {
  @ApiPropertyOptional({
    example: 'G02',
    description: 'Grade code',
  })
  @IsOptional()
  @IsString()
  gradeCode?: string;

  @ApiPropertyOptional({
    example: 'Updated Senior Grade',
    description: 'Grade details',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  gradeDetails?: string | null;

  @ApiPropertyOptional({
    example: 9000,
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
    example: 13000,
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
    example: false,
    description: 'Whether the grade is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}