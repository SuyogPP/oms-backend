import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class DesignationEntity {
  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    description: 'Unique designation identifier (UUID)',
  })
  designationId!: string;

  @ApiProperty({
    example: 'DES01',
    description: 'Unique designation code',
  })
  designationCode!: string;

  @ApiProperty({
    example: 'Senior Manager',
    description: 'Designation name',
  })
  designationName!: string;

  @ApiPropertyOptional({
    example: 'Senior management role',
    description: 'Designation summary',
    nullable: true,
  })
  designationSummary?: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the designation is active',
  })
  isActive!: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether the designation is soft deleted',
  })
  isDeleted!: boolean;

  @ApiProperty({
    example: 'admin',
    description: 'User who created the designation',
  })
  createdBy!: string;

  @ApiProperty({
    example: '2026-10-06',
    description: 'Date the designation was created',
  })
  createdDate!: string;

  @ApiPropertyOptional({
    example: 'admin',
    description: 'User who last modified the designation',
    nullable: true,
  })
  modifiedBy?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-06',
    description: 'Date the designation was last modified',
    nullable: true,
  })
  modifiedDate?: string | null;
}