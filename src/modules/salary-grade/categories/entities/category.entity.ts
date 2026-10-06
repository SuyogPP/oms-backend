import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CategoryEntity {
  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    description: 'Unique category identifier (UUID)',
  })
  categoryId!: string;

  @ApiProperty({
    example: 'CAT-01',
    description: 'Unique category code',
  })
  categoryCode!: string;

  @ApiPropertyOptional({
    example: 'Management Category',
    description: 'Category details',
    nullable: true,
  })
  categoryDetails?: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the category is active',
  })
  isActive!: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether the category is soft deleted',
  })
  isDeleted!: boolean;

  @ApiProperty({
    example: 'admin',
    description: 'User who created the category',
  })
  createdBy!: string;

  @ApiProperty({
    example: '2026-10-06',
    description: 'Date the category was created',
  })
  createdDate!: string;

  @ApiPropertyOptional({
    example: 'admin',
    description: 'User who last modified the category',
    nullable: true,
  })
  modifiedBy?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-06',
    description: 'Date the category was last modified',
    nullable: true,
  })
  modifiedDate?: string | null;
}