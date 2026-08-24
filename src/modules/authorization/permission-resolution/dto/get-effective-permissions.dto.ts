import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetEffectivePermissionsParamDto {
  @ApiProperty({
    description: 'Unique identifier of the target user',
    example: '1053433E-F36B-1410-85ED-009A959FB122',
  })
  @IsUUID()
  id!: string;
}
