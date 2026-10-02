import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { USER_TYPES } from '../users.constants';
import type { UserType } from '../users.constants';

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

  @ApiProperty({ example: 'Senior HR Manager', required: false })
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
