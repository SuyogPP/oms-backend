import { Injectable, NotImplementedException } from '@nestjs/common';
import { VendorUsersRepository } from '../repositories/vendor-users.repository';
import { CreateVendorUserDto, UpdateVendorUserDto } from '../dto/create-vendor-user.dto';
import { IVendorUser } from '../interfaces/vendor-users.interface';

@Injectable()
export class VendorUsersService {
  constructor(private readonly vendorUsersRepository: VendorUsersRepository) {}

  async findAll(operatorUserId?: string): Promise<IVendorUser[]> {
    throw new NotImplementedException('VendorUsersService.findAll is not yet implemented');
  }

  async create(dto: CreateVendorUserDto, operatorUserId?: string): Promise<IVendorUser> {
    throw new NotImplementedException('VendorUsersService.create is not yet implemented');
  }

  async update(id: string, dto: UpdateVendorUserDto, operatorUserId?: string): Promise<IVendorUser> {
    throw new NotImplementedException('VendorUsersService.update is not yet implemented');
  }

  async deactivate(id: string, operatorUserId?: string): Promise<void> {
    throw new NotImplementedException('VendorUsersService.deactivate is not yet implemented');
  }
}
