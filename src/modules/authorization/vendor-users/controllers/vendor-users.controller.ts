import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { VendorUsersService } from '../services/vendor-users.service';
import {
  CreateVendorUserDto,
  UpdateVendorUserDto,
} from '../dto/create-vendor-user.dto';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { VENDOR_USER_PERMISSIONS } from '../vendor-users.constants';

@ApiTags('Authorization - Vendor Users')
@ApiBearerAuth('JWT')
@Controller('authorization/vendor-users')
export class VendorUsersController {
  constructor(private readonly vendorUsersService: VendorUsersService) {}

  @Get()
  @RequirePermissions(VENDOR_USER_PERMISSIONS.MANAGE)
  @UseGuards(PermissionGuard)
  @ApiOperation({
    summary: 'List all vendor users (Rule V9: isolated from internal users)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of vendor users retrieved successfully',
  })
  async findAll(@CurrentUser() currentUser?: ICurrentUser) {
    return this.vendorUsersService.findAll(currentUser?.userId);
  }

  @Get(':id')
  @RequirePermissions(VENDOR_USER_PERMISSIONS.MANAGE)
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Get a vendor user by ID' })
  @ApiParam({ name: 'id', description: 'Vendor User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vendor user details retrieved',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vendor user not found',
  })
  async findById(@Param('id') id: string) {
    return this.vendorUsersService.findById(id);
  }

  @Post()
  @RequirePermissions(VENDOR_USER_PERMISSIONS.MANAGE)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a new vendor user (Managed by Procurement under VENDORUSER.MANAGE)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Vendor user created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failure: missing vendorId, invalid shape, email/username duplicate',
  })
  async create(
    @Body() dto: CreateVendorUserDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.vendorUsersService.create(dto, currentUser?.userId);
  }

  @Patch(':id')
  @RequirePermissions(VENDOR_USER_PERMISSIONS.MANAGE)
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Update vendor user details' })
  @ApiParam({ name: 'id', description: 'Vendor User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vendor user updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vendor user not found',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorUserDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.vendorUsersService.update(id, dto, currentUser?.userId);
  }

  @Post(':id/deactivate')
  @RequirePermissions(VENDOR_USER_PERMISSIONS.MANAGE)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a vendor user account' })
  @ApiParam({ name: 'id', description: 'Vendor User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vendor user deactivated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vendor user not found',
  })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    await this.vendorUsersService.deactivate(id, currentUser?.userId);
    return {
      success: true,
      message: 'Vendor user deactivated successfully.',
    };
  }

  @Post('vendors/:vendorId/deactivate')
  @RequirePermissions(VENDOR_USER_PERMISSIONS.MANAGE)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Deactivate all users associated with a specific vendor (Rule V10 cascade)',
  })
  @ApiParam({ name: 'vendorId', description: 'Vendor UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All vendor users deactivated successfully',
  })
  async deactivateByVendor(
    @Param('vendorId') vendorId: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    await this.vendorUsersService.deactivateAllByVendorId(
      vendorId,
      currentUser?.userId,
    );
    return {
      success: true,
      message: `All users for Vendor [${vendorId}] deactivated successfully.`,
    };
  }
}
