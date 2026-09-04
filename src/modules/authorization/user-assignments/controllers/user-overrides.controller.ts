import {
  Controller,
  Get,
  Post,
  Delete,
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
import { UserOverridesService } from '../services/user-overrides.service';
import { ManageOverrideDto } from '../dto/manage-override.dto';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { USER_PERMISSIONS } from '../../users/users.constants';

@ApiTags('Authorization - Permission Overrides')
@ApiBearerAuth('JWT')
@Controller('authorization/users/:id/overrides')
export class UserOverridesController {
  constructor(private readonly userOverridesService: UserOverridesService) {}

  @Get()
  @RequirePermissions(USER_PERMISSIONS.VIEW)
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Get all permission overrides for a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of permission overrides retrieved',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findByUserId(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.userOverridesService.findByUserId(id, currentUser?.userId);
  }

  @Post()
  @RequirePermissions(USER_PERMISSIONS.OVERRIDE_MANAGE)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a grant or revoke permission override (SYSTEM_ADMIN only, mandatory Reason)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Permission override created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing mandatory reason or invalid permission',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Cannot grant overrides to yourself (U14/9.1)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Missing USER.OVERRIDE.MANAGE permission',
  })
  async createOverride(
    @Param('id') id: string,
    @Body() dto: ManageOverrideDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.userOverridesService.createOverride(
      id,
      dto,
      currentUser?.userId,
    );
  }

  @Delete(':overrideId')
  @RequirePermissions(USER_PERMISSIONS.OVERRIDE_MANAGE)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke a permission override (sets EffectiveTo = now)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiParam({ name: 'overrideId', description: 'UserPermissionOverride UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Permission override revoked successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Cannot revoke overrides on your own account',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Permission override not found',
  })
  async revokeOverride(
    @Param('overrideId') overrideId: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    await this.userOverridesService.revokeOverride(
      overrideId,
      currentUser?.userId,
    );
    return {
      success: true,
      message: 'Permission override revoked successfully.',
    };
  }
}
