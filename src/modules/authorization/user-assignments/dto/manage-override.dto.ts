import {
  IsUUID,
  IsNotEmpty,
  IsBoolean,
  IsString,
  IsOptional,
  IsDateString,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManageOverrideDto {
  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    description:
      'Permission UUID to grant (IsGranted=true) or revoke (IsGranted=false)',
  })
  @IsUUID()
  @IsNotEmpty()
  permissionId!: string;

  @ApiProperty({
    example: true,
    description:
      'true to grant override permission; false to explicitly revoke permission',
  })
  @IsBoolean()
  @IsNotEmpty()
  isGranted!: boolean;

  @ApiProperty({
    example:
      'Temporary financial approval authority during annual audit closure',
    description: 'Mandatory justification for audit trail and compliance',
  })
  @IsString()
  @IsNotEmpty({
    message:
      'A justification reason is mandatory for all permission overrides.',
  })
  @MinLength(5, {
    message: 'Reason must be at least 5 characters long for auditing.',
  })
  reason!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @ApiProperty({ example: '2026-09-30T00:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}
