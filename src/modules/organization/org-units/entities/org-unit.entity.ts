import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrgUnitTypeEntity } from './org-unit-type.entity';

export class OrgBreadcrumbItemEntity {
  @ApiProperty({ example: 1, description: 'Org unit identifier' })
  orgUnitId: number;

  @ApiProperty({ example: 'IT', description: 'Unique code' })
  orgCode: string;

  @ApiProperty({ example: 'Information Technology', description: 'English name' })
  orgName: string;
}

export class OrgHeadSummaryEntity {
  @ApiProperty({ example: 'UUID', description: 'Head user ID' })
  userId: string;

  @ApiProperty({ example: 'John Doe', description: 'Head display name' })
  displayName: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  email?: string;
}

export class OrgUnitEntity {
  @ApiProperty({ example: 1, description: 'Org unit identifier' })
  orgUnitId: number;

  @ApiProperty({ type: () => OrgUnitTypeEntity })
  orgUnitType: OrgUnitTypeEntity;

  @ApiPropertyOptional({ example: 2, description: 'Parent org unit identifier' })
  parentId: number | null;

  @ApiProperty({ example: 'IT', description: 'Unique code' })
  orgCode: string;

  @ApiProperty({ example: 'Information Technology', description: 'English name' })
  orgName: string;

  @ApiPropertyOptional({ example: 'CC-1000', description: 'Cost center code' })
  costCenterCode?: string | null;

  @ApiPropertyOptional({
    example: 'guid',
    description: 'Active Directory Object GUID',
  })
  adObjectGuid?: string | null;

  @ApiPropertyOptional({ type: () => OrgHeadSummaryEntity })
  head?: OrgHeadSummaryEntity | null;

  @ApiProperty({ example: true, description: 'Can hold budget' })
  allowsBudget: boolean;

  @ApiProperty({ example: true, description: 'Can create requisitions' })
  allowsRequisition: boolean;

  @ApiProperty({ example: true, description: 'Active status' })
  isActive: boolean;
}

export class OrgUnitDetailEntity extends OrgUnitEntity {
  @ApiProperty({ example: 3, description: 'Direct active child count' })
  childCount: number;

  @ApiProperty({ example: 12, description: 'Total active descendant count' })
  descendantCount: number;

  @ApiProperty({ example: 45, description: 'Active members count' })
  peopleCount: number;

  @ApiProperty({
    type: [OrgBreadcrumbItemEntity],
    description: 'Breadcrumb trail',
  })
  breadcrumb: OrgBreadcrumbItemEntity[];
}

export class OrgUnitTreeItemEntity {
  @ApiProperty({ example: 1 })
  orgUnitId: number;

  @ApiProperty({ example: 3 })
  unitTypeId: number;

  @ApiPropertyOptional({ example: 2 })
  parentId: number | null;

  @ApiProperty({ example: 'IT' })
  orgCode: string;

  @ApiProperty({ example: 'Information Technology' })
  orgName: string;

  @ApiProperty({ example: true })
  allowsBudget: boolean;

  @ApiProperty({ example: true })
  allowsRequisition: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ type: () => OrgHeadSummaryEntity })
  head?: OrgHeadSummaryEntity | null;

  @ApiPropertyOptional({
    type: () => [OrgUnitTreeItemEntity],
    description: 'Child nodes',
  })
  children?: OrgUnitTreeItemEntity[];
}
