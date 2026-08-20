import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ORG_CODE_REGEX } from '../org-units.constants';

export class UpdateOrgUnitDto {
  @ApiPropertyOptional({
    description: 'Do NOT use for reparenting. Changing parentOrgUnitId via PATCH is rejected.',
  })
  @IsOptional()
  parentOrgUnitId?: any;

  @ApiPropertyOptional({ example: 'IT' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(ORG_CODE_REGEX, {
    message:
      'Code must start with alphanumeric and contain only uppercase letters, numbers, underscores, and hyphens (2-50 chars).',
  })
  code?: string;

  @ApiPropertyOptional({ example: 'Information Technology' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'تقنية المعلومات' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string | null;

  @ApiPropertyOptional({ example: 'IT' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string | null;

  @ApiPropertyOptional({ example: 'Enterprise IT infrastructure and services' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ example: 'CC-1042' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  costCenterCode?: string | null;

  @ApiPropertyOptional({ example: 'ORG_IT_001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  oracleOrgCode?: string | null;

  @ApiPropertyOptional({ example: 'it@diez.ae' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  emailAddress?: string | null;

  @ApiPropertyOptional({ example: '+97141234567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string | null;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  effectiveTo?: string | null;
}
