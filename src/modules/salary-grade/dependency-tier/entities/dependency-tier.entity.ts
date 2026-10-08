import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class DependencyTierEntity {
  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    description: 'Unique dependency tier identifier (UUID)',
  })
  tierId!: string;

  @ApiProperty({
    example: 'TIER01',
    description: 'Unique dependency tier code',
  })
  tierCode!: string;

  @ApiPropertyOptional({
    example: 'Spouse and children dependency tier',
    description: 'Dependency tier description',
    nullable: true,
  })
  description?: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the dependency tier is active',
  })
  isActive!: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether the dependency tier is soft deleted',
  })
  isDeleted!: boolean;

  @ApiProperty({
    example: 'admin',
    description: 'User who created the dependency tier',
  })
  createdBy!: string;

  @ApiProperty({
    example: '2026-10-06',
    description: 'Date the dependency tier was created',
  })
  createdDate!: string;

  @ApiPropertyOptional({
    example: 'admin',
    description: 'User who last modified the dependency tier',
    nullable: true,
  })
  modifiedBy?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-06',
    description: 'Date the dependency tier was last modified',
    nullable: true,
  })
  modifiedDate?: string | null;
}