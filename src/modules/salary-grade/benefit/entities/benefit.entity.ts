import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class BenefitEntity {
  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    description: 'Unique benefit identifier (UUID)',
  })
  benefitId!: string;

  @ApiProperty({
    example: 'Medical Insurance',
    description: 'Benefit name',
  })
  benefitName!: string;

  @ApiPropertyOptional({
    example: 'Medical insurance coverage for eligible employees',
    description: 'Benefit description',
    nullable: true,
  })
  benefitDescription?: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the benefit is active',
  })
  isActive!: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether the benefit is soft deleted',
  })
  isDeleted!: boolean;

  @ApiProperty({
    example: 'admin',
    description: 'User who created the benefit',
  })
  createdBy!: string;

  @ApiProperty({
    example: '2026-10-06',
    description: 'Date the benefit was created',
  })
  createdDate!: string;

  @ApiPropertyOptional({
    example: 'admin',
    description: 'User who last modified the benefit',
    nullable: true,
  })
  modifiedBy?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-06',
    description: 'Date the benefit was last modified',
    nullable: true,
  })
  modifiedDate?: string | null;
}