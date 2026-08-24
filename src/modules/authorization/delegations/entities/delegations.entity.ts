import { ApiProperty } from '@nestjs/swagger';
import { IDelegation } from '../interfaces/delegations.interface';

export class DelegationEntity implements IDelegation {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  delegationId!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  fromUserId!: string;

  @ApiProperty({ example: 'Ahmed Al Mansouri', required: false })
  fromUserName?: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  toUserId!: string;

  @ApiProperty({ example: 'Fatima Al Zarooni', required: false })
  toUserName?: string;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  startDate!: Date;

  @ApiProperty({ example: '2026-09-05T00:00:00.000Z' })
  endDate!: Date;

  @ApiProperty({ example: 'Annual leave delegation for departmental approvals' })
  reason!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: ['REQUISITION.APPROVE'], required: false })
  permissionCodes?: string[];

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  createdAt!: Date;
}
