import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  username!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  userType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mobileNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  jobTitle?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  businessUnitId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;
}
