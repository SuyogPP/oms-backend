import {
    IsEmail,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    employeeId: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    firstName: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    lastName: string;

    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @IsInt()
    roleId: number;

    @IsOptional()
    @IsInt()
    departmentId?: number;

    @IsOptional()
    @IsInt()
    designationId?: number;
}