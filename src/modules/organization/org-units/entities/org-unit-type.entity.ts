import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrgUnitTypeEntity {
  @ApiProperty({ example: 3, description: 'Org unit type identifier' })
  unitTypeId: number;

  @ApiProperty({ example: 2, description: 'Parent type ID' })
  parentUnitTypeId: number | null;

  @ApiProperty({ example: 'DEPARTMENT', description: 'Unique code' })
  orgUnitCode: string;

  @ApiProperty({ example: 'Department', description: 'English name' })
  orgUnitName: string;

  @ApiProperty({ example: 3, description: 'Level 1-3' })
  level: number;

  @ApiProperty({
    example: true,
    description: 'Allows annual budget allocation',
  })
  allowsBudget: boolean;

  @ApiProperty({ example: true, description: 'Allows requisition submissions' })
  allowsRequisition: boolean;

  @ApiProperty({ example: true, description: 'Active status' })
  isActive: boolean;
}

export class OrgUnitTypeHierarchyRuleEntity {
  @ApiProperty({ example: 3, description: 'Child type ID' })
  childOrgUnitTypeId: number;

  @ApiProperty({ example: 2, description: 'Parent type ID' })
  parentOrgUnitTypeId: number;

  @ApiProperty({ example: true, description: 'Rule active' })
  isActive: boolean;
}
