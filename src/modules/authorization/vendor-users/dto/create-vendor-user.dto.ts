import { IsString, IsEmail, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVendorUserDto {
  @ApiProperty({ example: 'ahmed.vendor' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'ahmed@alnaboodah.ae' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  @IsUUID()
  @IsNotEmpty()
  vendorId!: string;

  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Khan' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: '+971501112233', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ example: 'Project Account Manager', required: false })
  @IsString()
  @IsOptional()
  jobTitle?: string;
}

export class UpdateVendorUserDto {
  @ApiProperty({ example: 'ahmed@alnaboodah.ae', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'Ahmed', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Khan', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: '+971501112233', required: false })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ example: 'Lead Commercial Executive', required: false })
  @IsString()
  @IsOptional()
  jobTitle?: string;
}
