import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDelegationDto {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  @IsUUID()
  @IsNotEmpty()
  toUserId!: string;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({ example: '2026-09-05T00:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @ApiProperty({
    example: 'Annual leave delegation for departmental approvals',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({
    example: ['1053433E-F36B-1410-85ED-009A959FB122'],
    required: false,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  permissionIds?: string[];
}

export class UpdateDelegationDto {
  @ApiProperty({ example: '2026-09-10T00:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 'Extended leave duration', required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
