import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class DeploymentModelEntity {
  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    description: 'Unique deployment model identifier (UUID)',
  })
  deploymentId!: string;

  @ApiProperty({
    example: 'ONSITE_REMOTE',
    description: 'Deployment model code',
  })
  deploymentCode!: string;

  @ApiProperty({
    example: 'Onsite-Remote',
    description: 'Deployment model name',
  })
  deploymentName!: string;

  @ApiPropertyOptional({
    example: 'Onsite and remote working arrangement',
    description: 'Deployment work settings',
    nullable: true,
  })
  workSettings?: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the deployment model is active',
  })
  isActive!: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether the deployment model is deleted',
  })
  isDeleted!: boolean;

  @ApiProperty({
    example: 'admin',
    description: 'User who created the deployment model',
  })
  createdBy!: string;

  @ApiProperty({
    example: '2026-10-06',
    description: 'Date the deployment model was created',
  })
  createdDate!: string;

  @ApiPropertyOptional({
    example: 'admin',
    description: 'User who last modified the deployment model',
    nullable: true,
  })
  modifiedBy?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-06',
    description: 'Date the deployment model was last modified',
    nullable: true,
  })
  modifiedDate?: string | null;
}