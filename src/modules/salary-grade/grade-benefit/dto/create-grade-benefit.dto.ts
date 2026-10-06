import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateGradeBenefitDto {
  @ApiProperty()
  @IsUUID()
  deploymentId!: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsUUID()
  designationId!: string;

  @ApiProperty()
  @IsUUID()
  gradeId!: string;

  @ApiProperty()
  @IsUUID()
  tierId!: string;

  @ApiProperty()
  @IsUUID()
  benefitId!: string;

  @ApiProperty({
    example: false,
  })
  @IsBoolean()
  officeSetup!: boolean;

  @ApiPropertyOptional({
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}