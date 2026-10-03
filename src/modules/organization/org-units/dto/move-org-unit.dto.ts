import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, MaxLength } from 'class-validator';

export class MoveOrgUnitDto {
  @ApiProperty({ example: 456, description: 'Target parent org unit ID' })
  @IsNumber()
  newParentId: number;

  @ApiPropertyOptional({
    example: 'Restructuring',
    description: 'Audit reason for move',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
