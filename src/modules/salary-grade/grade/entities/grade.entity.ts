import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class GradeEntity {
  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    description: 'Unique grade identifier (UUID)',
  })
  gradeId!: string;

  @ApiProperty({
    example: 'G01',
    description: 'Unique grade code',
  })
  gradeCode!: string;

  @ApiPropertyOptional({
    example: 'Senior Grade',
    description: 'Grade details',
    nullable: true,
  })
  gradeDetails?: string | null;

  @ApiPropertyOptional({
    example: 8000,
    description: 'Minimum salary for the grade',
    nullable: true,
  })
  minSalary?: number | null;

  @ApiPropertyOptional({
    example: 12000,
    description: 'Maximum salary for the grade',
    nullable: true,
  })
  maxSalary?: number | null;

  @ApiProperty({
    example: true,
    description: 'Whether the grade is active',
  })
  isActive!: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether the grade is soft deleted',
  })
  isDelete!: boolean;

  @ApiProperty({
    example: 'admin',
    description: 'User who created the grade',
  })
  createdBy!: string;

  @ApiProperty({
    example: '2026-10-06',
    description: 'Date the grade was created',
  })
  createdDate!: string;

  @ApiPropertyOptional({
    example: 'admin',
    description: 'User who last modified the grade',
    nullable: true,
  })
  modifiedBy?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-06',
    description: 'Date the grade was last modified',
    nullable: true,
  })
  modifiedDate?: string | null;
}