import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class MoveOrgUnitDto {
  @ApiProperty({
    example: '55555555-6666-7777-8888-999999999999',
    description: 'The new parent OrgUnitId',
  })
  @IsUUID()
  @IsNotEmpty()
  newParentOrgUnitId: string;

  @ApiPropertyOptional({
    example: '2026 reorganisation — IT consolidated under Corporate Services',
    description: 'Business justification for structural reorganization',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiProperty({
    example: '0x00000000000007D1',
    description: 'Mandatory optimistic concurrency token (RowVersion)',
  })
  @IsString()
  @IsNotEmpty()
  rowVersion: string;
}
