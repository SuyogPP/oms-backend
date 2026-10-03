import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Matches,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { ORG_CODE_REGEX } from '../org-units.constants';

export class CreateOrgUnitDto {
  @ApiProperty({ example: 3, description: 'Org unit type identifier' })
  @IsNumber()
  unitTypeId: number;

  @ApiPropertyOptional({
    example: 123,
    description: 'Parent org unit ID (null for root)',
  })
  @IsOptional()
  @IsNumber()
  parentId?: number;

  @ApiProperty({ example: 'IT', description: 'Unique org code' })
  @IsString()
  @Matches(ORG_CODE_REGEX, {
    message: 'Code must be uppercase alphanumeric without spaces',
  })
  @MinLength(2)
  @MaxLength(50)
  orgCode: string;

  @ApiProperty({ example: 'Information Technology', description: 'English name' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  orgName: string;

  @ApiPropertyOptional({ example: 'CC-1000' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  costCenterCode?: string;

  @ApiPropertyOptional({ example: 'guid' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  adObjectGuid?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
