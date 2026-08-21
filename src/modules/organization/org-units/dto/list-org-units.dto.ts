import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';

export class ListOrgUnitsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by OrgUnitTypeId (1=ORG, 2=BU, 3=DEPT, 4=SECTION)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orgUnitTypeId?: number;

  @ApiPropertyOptional({ description: 'Filter by hierarchy depth level (0=root, 1=BU, 2=DEPT, 3=SECTION)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  depth?: number;

  @ApiPropertyOptional({ description: 'Filter direct children of specified parent' })
  @IsOptional()
  @IsUUID()
  parentOrgUnitId?: string;

  @ApiPropertyOptional({ description: 'Search term for name or code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}
