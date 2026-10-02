import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { USER_TYPES } from '../users.constants';
import type { UserType } from '../users.constants';

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

  @ApiProperty({ example: 'Fatima', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Al Zarooni', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: '+971509876543', required: false })
  @IsString()
  @IsOptional()
  mobileNo?: string;

  @ApiProperty({ example: 'Director Human Capital', required: false })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiProperty({ example: '123', required: false })
  @IsString()
  @IsOptional()
  orgUnitId?: string;

  @ApiProperty({ example: 456, required: false })
  @IsNumber()
  @IsOptional()
  vendorId?: number;
}
