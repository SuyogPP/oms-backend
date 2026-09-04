import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ORG_CODE_REGEX } from '../org-units.constants';

export class CreateOrgUnitDto {
  @ApiProperty({
    example: 3,
    description: 'Org unit type ID (1=ORG, 2=BU, 3=DEPT, 4=SECTION)',
  })
  @IsInt()
  @Min(1)
  orgUnitTypeId: number;

  @ApiPropertyOptional({
    example: '11111111-2222-3333-4444-555555555555',
    description: 'Parent OrgUnitId. Required unless root ORGANIZATION type.',
  })
  @IsOptional()
  @IsUUID()
  parentOrgUnitId?: string | null;

  @ApiProperty({
    example: 'IT',
    description: 'Unique code among live siblings',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(ORG_CODE_REGEX, {
    message:
      'Code must start with alphanumeric and contain only uppercase letters, numbers, underscores, and hyphens (2-50 chars).',
  })
  code: string;

  @ApiProperty({ example: 'Information Technology' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

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

  @ApiPropertyOptional({ example: 30, default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  effectiveFrom?: string;
}
