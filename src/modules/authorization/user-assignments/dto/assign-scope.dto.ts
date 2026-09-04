import { IsUUID, IsOptional, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignScopeDto {
  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    description:
      'ScopeDefinition UUID (GLOBAL, ORGANIZATION, BUSINESS_UNIT, DEPARTMENT, SECTION)',
  })
  @IsUUID()
  @IsNotEmpty()
  scopeDefinitionId!: string;

  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    required: false,
    description: 'Unified OrgUnitId pointer (Domain 2 reconciliation Option a)',
  })
  @IsUUID()
  @IsOptional()
  orgUnitId?: string;

  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  businessUnitId?: string;

  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  sectionId?: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @ApiProperty({ example: null, required: false })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}

export class ScopeCountResponseDto {
  @ApiProperty({
    example: 42,
    description:
      'Number of active organizational units accessible under the specified scope',
  })
  accessibleOrgUnitsCount!: number;

  @ApiProperty({ example: 'DEPARTMENT', description: 'Scope level code' })
  scopeCode!: string;

  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    required: false,
    description: 'Root organizational unit ID',
  })
  orgUnitId?: string | null;
}
