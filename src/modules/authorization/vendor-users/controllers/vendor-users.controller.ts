import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VendorUsersService } from '../services/vendor-users.service';
import { CreateVendorUserDto, UpdateVendorUserDto } from '../dto/create-vendor-user.dto';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';

@ApiTags('Authorization - Vendor Users')
@ApiBearerAuth('JWT')
@Controller('authorization/vendor-users')
export class VendorUsersController {
  constructor(private readonly vendorUsersService: VendorUsersService) {}

  @Get()
  @RequirePermissions('VENDORUSER.MANAGE')
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'List all vendor users' })
  async findAll(@CurrentUser() currentUser?: ICurrentUser) {
    return this.vendorUsersService.findAll(currentUser?.userId);
  }

  @Post()
  @RequirePermissions('VENDORUSER.MANAGE')
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Create a new vendor user' })
  async create(
    @Body() dto: CreateVendorUserDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.vendorUsersService.create(dto, currentUser?.userId);
  }

  @Patch(':id')
  @RequirePermissions('VENDORUSER.MANAGE')
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Update vendor user details' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorUserDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.vendorUsersService.update(id, dto, currentUser?.userId);
  }

  @Post(':id/deactivate')
  @RequirePermissions('VENDORUSER.MANAGE')
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Deactivate vendor user account' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.vendorUsersService.deactivate(id, currentUser?.userId);
  }
}
