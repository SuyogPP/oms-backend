import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class GradeBenefitEntity {
  @ApiProperty()
  salaryGradeId!: string;

  @ApiProperty()
  deploymentId!: string;

  @ApiProperty()
  deploymentCode!: string;

  @ApiProperty()
  deploymentName!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  categoryCode!: string;

  @ApiPropertyOptional({
    nullable: true,
  })
  categoryDetails?: string | null;

  @ApiProperty()
  designationId!: string;

  @ApiProperty()
  designationCode!: string;

  @ApiProperty()
  designationName!: string;

  @ApiPropertyOptional({
    nullable: true,
  })
  designationSummary?: string | null;

  @ApiProperty()
  gradeId!: string;

  @ApiProperty()
  gradeCode!: string;

  @ApiPropertyOptional({
    nullable: true,
  })
  gradeDetails?: string | null;

  @ApiPropertyOptional({
    example: 8000,
    nullable: true,
  })
  minSalary?: number | null;

  @ApiPropertyOptional({
    example: 12000,
    nullable: true,
  })
  maxSalary?: number | null;

  @ApiProperty()
  tierId!: string;

  @ApiProperty()
  tierCode!: string;

  @ApiPropertyOptional({
    nullable: true,
  })
  tierDescription?: string | null;

  @ApiProperty()
  benefitId!: string;

  @ApiProperty()
  benefitName!: string;

  @ApiPropertyOptional({
    nullable: true,
  })
  benefitDescription?: string | null;

  @ApiProperty({
    example: true,
  })
  officeSetup!: boolean;

  @ApiProperty({
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    example: false,
  })
  isDeleted!: boolean;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty()
  createdDate!: string;

  @ApiPropertyOptional({
    nullable: true,
  })
  modifiedBy?: string | null;

  @ApiPropertyOptional({
    nullable: true,
  })
  modifiedDate?: string | null;
}