import { ApiProperty } from '@nestjs/swagger';
import {
  EffectivePermissionItem,
  RevokedPermissionItem,
  EffectivePermissionsResponse,
} from '../interfaces/permission-resolution.interface';
import type { PermissionSourceType } from '../permission-resolution.constants';

export class EffectivePermissionItemEntity implements EffectivePermissionItem {
  @ApiProperty({ example: 'REQUISITION.APPROVE' })
  code!: string;

  @ApiProperty({
    example: 'ROLE',
    enum: ['ROLE', 'ROLE_INHERITED', 'OVERRIDE_GRANT', 'DELEGATION'],
  })
  source!: PermissionSourceType;

  @ApiProperty({ example: 'HOD', required: false })
  via?: string;

  @ApiProperty({ example: 'Temporary — audit review', required: false })
  reason?: string;

  @ApiProperty({ example: '2026-09-30', required: false, nullable: true })
  until?: string | null;
}

export class RevokedPermissionItemEntity implements RevokedPermissionItem {
  @ApiProperty({ example: 'REQUISITION.CREATE' })
  code!: string;

  @ApiProperty({ example: 'OVERRIDE_REVOKE' })
  source!: 'OVERRIDE_REVOKE';

  @ApiProperty({ example: 'Under investigation', required: false })
  reason?: string;
}

export class EffectivePermissionsResponseEntity
  implements EffectivePermissionsResponse
{
  @ApiProperty({ type: [EffectivePermissionItemEntity] })
  permissions!: EffectivePermissionItemEntity[];

  @ApiProperty({ type: [RevokedPermissionItemEntity] })
  revoked!: RevokedPermissionItemEntity[];
}
