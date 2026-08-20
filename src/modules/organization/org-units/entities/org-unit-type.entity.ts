import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrgUnitTypeEntity {
  @ApiProperty({ example: 3, description: 'Org unit type identifier' })
  orgUnitTypeId: number;

  @ApiProperty({ example: 'DEPARTMENT', description: 'Unique code' })
  code: string;

  @ApiProperty({ example: 'Department', description: 'English name' })
  name: string;

  @ApiPropertyOptional({ example: 'الإدارة', description: 'Arabic name' })
  nameAr?: string | null;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string | null;

  @ApiProperty({ example: 3, description: 'Canonical depth level' })
  canonicalLevel: number;

  @ApiProperty({ example: 'DEPARTMENT', description: 'Scope level code' })
  scopeLevelCode: string;

  @ApiProperty({ example: true, description: 'Allows annual budget allocation' })
  allowsBudget: boolean;

  @ApiProperty({ example: true, description: 'Allows requisition submissions' })
  allowsRequisition: boolean;

  @ApiProperty({ example: true, description: 'Allows assigned manager' })
  allowsManager: boolean;

  @ApiProperty({ example: false, description: 'Is root holding type' })
  isRootType: boolean;

  @ApiProperty({ example: 30, description: 'Display sort order' })
  sortOrder: number;

  @ApiProperty({ example: true, description: 'Active status' })
  isActive: boolean;

  @ApiPropertyOptional({
    example: [2, 3],
    description: 'Permitted child OrgUnitTypeIds',
    type: [Number],
  })
  allowedChildTypeIds?: number[];
}

export class OrgUnitTypeHierarchyRuleEntity {
  @ApiProperty({ example: 3, description: 'Child type ID' })
  childOrgUnitTypeId: number;

  @ApiProperty({ example: 2, description: 'Parent type ID' })
  parentOrgUnitTypeId: number;

  @ApiProperty({ example: true, description: 'Rule active' })
  isActive: boolean;
}
