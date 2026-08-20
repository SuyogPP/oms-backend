import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateManagerDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  effectiveTo?: string | null;

  @ApiPropertyOptional({ example: 'Tenure updated' })
  @IsOptional()
  @IsString()
  assignmentReason?: string | null;
}
