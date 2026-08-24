import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { USER_TYPES } from '../users.constants';
import type { UserType } from '../users.constants';

export class CreateUserProfileDto {
  @ApiProperty({ example: 'Fatima' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Al Zarooni' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'Fatima Al Zarooni', required: false })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({ example: '+971509876543', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ example: 'Senior HR Manager', required: false })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  @IsUUID()
  @IsOptional()
  businessUnitId?: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  @IsUUID()
  @IsOptional()
  sectionId?: string;

  @ApiProperty({ example: null, required: false })
  @IsUUID()
  @IsOptional()
  vendorId?: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'EMP-0098', required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ example: 'fatima.zarooni' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'fatima.zarooni@diez.ae' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'INTERNAL', enum: USER_TYPES })
  @IsEnum(USER_TYPES)
  userType!: UserType;

  @ApiProperty({ example: null, required: false })
  @IsString()
  @IsOptional()
  adObjectId?: string;

  @ApiProperty({ type: CreateUserProfileDto })
  @ValidateNested()
  @Type(() => CreateUserProfileDto)
  profile!: CreateUserProfileDto;
}
