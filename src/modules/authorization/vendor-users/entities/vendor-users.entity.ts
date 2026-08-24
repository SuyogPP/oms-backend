import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../../users/entities/user.entity';

export class VendorUserEntity extends UserEntity {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  vendorId!: string;

  @ApiProperty({ example: 'Al Naboodah Construction Group', required: false })
  vendorName?: string;
}
