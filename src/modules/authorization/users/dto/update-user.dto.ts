import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { USER_TYPES } from '../users.constants';
import type { UserType } from '../users.constants';

export class UpdateUserProfileDto {
  @ApiProperty({ example: 'Fatima', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Al Zarooni', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: 'Fatima Al Zarooni', required: false })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({ example: '+971509876543', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ example: 'Director Human Capital', required: false })
  @IsString()
  @IsOptional()
  jobTitle?: string;

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
  businessUnitId?: string;

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
  sectionId?: string;

  @ApiProperty({ example: null, required: false })
  @IsUUID()
  @IsOptional()
  vendorId?: string;
}

export class UpdateUserDto {
  @ApiProperty({ example: 'EMP-0098', required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ example: 'fatima.zarooni', required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ example: 'fatima.zarooni@diez.ae', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'INTERNAL', enum: USER_TYPES, required: false })
  @IsEnum(USER_TYPES)
  @IsOptional()
  userType?: UserType;

  @ApiProperty({ type: UpdateUserProfileDto, required: false })
  @ValidateNested()
  @Type(() => UpdateUserProfileDto)
  @IsOptional()
  profile?: UpdateUserProfileDto;
}
