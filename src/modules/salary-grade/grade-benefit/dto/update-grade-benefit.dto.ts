import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class UpdateGradeBenefitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deploymentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  designationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  benefitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  officeSetup?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}