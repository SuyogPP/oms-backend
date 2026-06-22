import {
    IsOptional,
    IsString,
    Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserDto {

    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
    firstName?: string;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
    lastName?: string;

    @IsOptional()
    @Matches(/^[0-9]{8,15}$/)
    @Transform(({ value }) => value?.trim())
    mobileNo?: string;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
    jobTitle?: string;

    @IsOptional()
    @IsString()
    departmentId?: string;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
    businessUnitId?: string;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => value?.trim())
    sectionId?: string;

}