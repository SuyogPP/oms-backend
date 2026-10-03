import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrgUnitChangeLogEntity {
  @ApiProperty({ example: 1 })
  orgUnitChangeLogId: number;

  @ApiProperty({ example: '77777777-8888-9999-0000-111111111111' })
  orgUnitId: number;

  @ApiProperty({ example: 'MOVED' })
  changeType: string;

  @ApiPropertyOptional({ example: '66666666-7777-8888-9999-000000000000' })
  oldParentId?: number | null;

  @ApiPropertyOptional({ example: '55555555-6666-7777-8888-999999999999' })
  newParentId?: number | null;

  @ApiPropertyOptional()
  oldValues?: any;

  @ApiPropertyOptional()
  newValues?: any;

  @ApiPropertyOptional({ example: '2026 reorganisation' })
  reason?: string | null;

  @ApiPropertyOptional({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  performedBy?: string | null;

  @ApiProperty({ example: '2026-08-20T10:00:00.000Z' })
  performedAt: Date;
}
