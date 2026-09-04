import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ORG_MANAGER_ROLES } from '../org-managers.constants';

export class AssignManagerDto {
  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    description: 'Internal User ID to be assigned as manager',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: 'HEAD',
    enum: ['HEAD', 'DEPUTY', 'ACTING'],
    description: 'Manager role type',
  })
  @IsIn([
    ORG_MANAGER_ROLES.HEAD,
    ORG_MANAGER_ROLES.DEPUTY,
    ORG_MANAGER_ROLES.ACTING,
  ])
  @IsNotEmpty()
  managerRoleCode: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      'Designates the primary unit head (auto-ends previous primary HEAD)',
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiProperty({
    example: '2026-09-01',
    description: 'Start date (YYYY-MM-DD)',
  })
  @IsString()
  @IsNotEmpty()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: null, description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  effectiveTo?: string | null;

  @ApiPropertyOptional({ example: 'Promoted to Head of Department' })
  @IsOptional()
  @IsString()
  assignmentReason?: string | null;
}
