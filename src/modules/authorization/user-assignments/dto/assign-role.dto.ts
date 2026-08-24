import { IsUUID, IsOptional, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRoleDto {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  @IsUUID()
  @IsNotEmpty()
  roleId!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  effectiveFrom?: Date;

  @ApiProperty({ example: '2026-12-31T00:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  effectiveTo?: Date;
}
