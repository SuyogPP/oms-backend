import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrgUnitTypeEntity } from './org-unit-type.entity';

export class OrgHeadSummaryEntity {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userId: string;

  @ApiProperty({ example: 'John Doe' })
  displayName: string;

  @ApiPropertyOptional({ example: 'john.doe@diez.ae' })
  email?: string;

  @ApiProperty({ example: '2026-01-01' })
  effectiveFrom: string;
}

export class OrgBreadcrumbItemEntity {
  @ApiProperty({ example: '11111111-2222-3333-4444-555555555555' })
  orgUnitId: string;

  @ApiProperty({ example: 'DIEZ' })
  code: string;

  @ApiProperty({ example: 'Dubai Integrated Economic Zones' })
  name: string;
}

export class OrgUnitEntity {
  @ApiProperty({ example: '77777777-8888-9999-0000-111111111111' })
  orgUnitId: string;

  @ApiProperty({ type: () => OrgUnitTypeEntity })
  orgUnitType: OrgUnitTypeEntity;

  @ApiPropertyOptional({ example: '66666666-7777-8888-9999-000000000000' })
  parentOrgUnitId?: string | null;

  @ApiProperty({ example: 'IT' })
  code: string;

  @ApiProperty({ example: 'Information Technology' })
  name: string;

  @ApiPropertyOptional({ example: 'تقنية المعلومات' })
  nameAr?: string | null;

  @ApiPropertyOptional({ example: 'IT' })
  shortName?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ example: 2 })
  depth: number;

  @ApiPropertyOptional({ example: 'CC-1042' })
  costCenterCode?: string | null;

  @ApiPropertyOptional({ example: 'ORG_IT_001' })
  oracleOrgCode?: string | null;

  @ApiPropertyOptional({ example: 'it@diez.ae' })
  emailAddress?: string | null;

  @ApiPropertyOptional({ example: '+97141234567' })
  phoneNumber?: string | null;

  @ApiPropertyOptional({ type: () => OrgHeadSummaryEntity })
  head?: OrgHeadSummaryEntity | null;

  @ApiProperty({ example: true })
  allowsBudget: boolean;

  @ApiProperty({ example: true })
  allowsRequisition: boolean;

  @ApiProperty({ example: 10 })
  sortOrder: number;

  @ApiProperty({ example: '2026-01-01' })
  effectiveFrom: string;

  @ApiPropertyOptional({ example: null })
  effectiveTo?: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '0x00000000000007D1' })
  rowVersion: string;
}

export class OrgUnitDetailEntity extends OrgUnitEntity {
  @ApiProperty({ example: 4, description: 'Number of direct child units' })
  childCount: number;

  @ApiProperty({ example: 11, description: 'Total descendants in subtree' })
  descendantCount: number;

  @ApiProperty({
    type: () => [OrgBreadcrumbItemEntity],
    description: 'Ancestral path from root to parent',
  })
  breadcrumb: OrgBreadcrumbItemEntity[];
}

export class OrgUnitTreeItemEntity {
  @ApiProperty({ example: '77777777-8888-9999-0000-111111111111' })
  orgUnitId: string;

  @ApiProperty({ example: 3 })
  orgUnitTypeId: number;

  @ApiPropertyOptional({ example: '66666666-7777-8888-9999-000000000000' })
  parentOrgUnitId?: string | null;

  @ApiProperty({ example: 'IT' })
  code: string;

  @ApiProperty({ example: 'Information Technology' })
  name: string;

  @ApiPropertyOptional({ example: 'تقنية المعلومات' })
  nameAr?: string | null;

  @ApiProperty({ example: 2 })
  depth: number;

  @ApiProperty({ example: true })
  allowsBudget: boolean;

  @ApiProperty({ example: true })
  allowsRequisition: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ type: () => OrgHeadSummaryEntity })
  head?: OrgHeadSummaryEntity | null;

  @ApiPropertyOptional({ type: () => [OrgUnitTreeItemEntity] })
  children?: OrgUnitTreeItemEntity[];
}
