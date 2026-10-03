import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { ORG_CODE_REGEX } from '../org-units.constants';

export class UpdateOrgUnitDto {
  @ApiPropertyOptional({ example: 'IT' })
  @IsOptional()
  @IsString()
  @Matches(ORG_CODE_REGEX, {
    message: 'Code must be uppercase alphanumeric without spaces',
  })
  @MinLength(2)
  @MaxLength(50)
  orgCode?: string;

  @ApiPropertyOptional({ example: 'Information Technology' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  orgName?: string;

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
