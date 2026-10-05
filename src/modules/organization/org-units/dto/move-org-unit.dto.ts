import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, MaxLength } from 'class-validator';

export class MoveOrgUnitDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111', description: 'Target parent org unit ID' })
  @IsString()
  newParentId: any;

  @ApiPropertyOptional({
    example: 'Restructuring',
    description: 'Audit reason for move',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
