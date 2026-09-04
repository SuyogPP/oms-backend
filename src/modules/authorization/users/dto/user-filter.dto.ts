import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { USER_TYPES } from '../users.constants';
import type { UserType } from '../users.constants';

export class UserFilterDto {
  @ApiProperty({ example: 'fatima', required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ example: 'INTERNAL', enum: USER_TYPES, required: false })
  @IsEnum(USER_TYPES)
  @IsOptional()
  userType?: UserType;

  @ApiProperty({
    example: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE', 'INVITED', 'LOCKED'],
    required: false,
  })
  @IsString()
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'LOCKED';

  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  businessUnitId?: string;

  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiProperty({
    example: 'FINANCE_APPROVER',
    required: false,
    description: 'Role code or Role ID',
  })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({
    example: false,
    required: false,
    description: 'Filter users who have zero active roles',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  hasNoRole?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isLocked?: boolean;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page: number = 1;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit: number = 20;

  @ApiProperty({ example: 'createdAt', required: false, default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy: string = 'createdAt';

  @ApiProperty({
    example: 'DESC',
    enum: ['ASC', 'DESC'],
    required: false,
    default: 'DESC',
  })
  @IsEnum(['ASC', 'DESC'])
  @IsOptional()
  sortOrder: 'ASC' | 'DESC' = 'DESC';
}
