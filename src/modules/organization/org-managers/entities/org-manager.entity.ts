import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrgManagerEntity {
  @ApiProperty({ example: '88888888-9999-0000-1111-222222222222' })
  orgUnitManagerId: string;

  @ApiProperty({ example: '77777777-8888-9999-0000-111111111111' })
  orgUnitId: string;

  @ApiPropertyOptional({ example: 'Information Technology' })
  orgUnitName?: string;

  @ApiPropertyOptional({ example: 'IT' })
  orgUnitCode?: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userId: string;

  @ApiPropertyOptional({ example: 'john.doe' })
  username?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  userDisplayName?: string;

  @ApiPropertyOptional({ example: 'john.doe@diez.ae' })
  userEmail?: string;

  @ApiProperty({ example: 'HEAD', enum: ['HEAD', 'DEPUTY', 'ACTING'] })
  managerRoleCode: string;

  @ApiProperty({ example: true })
  isPrimary: boolean;

  @ApiProperty({ example: '2026-01-01' })
  effectiveFrom: string;

  @ApiPropertyOptional({ example: null })
  effectiveTo?: string | null;

  @ApiPropertyOptional({ example: 'Department head assignment' })
  assignmentReason?: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;
}
