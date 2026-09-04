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
import { UserRolesService } from '../services/user-roles.service';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { USER_PERMISSIONS } from '../../users/users.constants';

@ApiTags('Authorization - Role Assignments')
@ApiBearerAuth('JWT')
@Controller('authorization/users/:id/roles')
export class UserRolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  @Get()
  @RequirePermissions(USER_PERMISSIONS.VIEW)
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Get all role assignments for a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of role assignments retrieved',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findByUserId(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.userRolesService.findByUserId(id, currentUser?.userId);
  }

  @Post()
  @RequirePermissions(USER_PERMISSIONS.ROLE_ASSIGN)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Assign a role to a user (SYSTEM_ADMIN only, temporal support)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Role assigned successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Vendor user cannot receive internal roles',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Cannot assign roles to yourself (U14/9.1)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Missing USER.ROLE.ASSIGN permission',
  })
  async assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.userRolesService.assignRole(id, dto, currentUser?.userId);
  }

  @Delete(':userRoleId')
  @RequirePermissions(USER_PERMISSIONS.ROLE_ASSIGN)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Revoke a role assignment from a user (sets EffectiveTo = now, preserves IsActive per 4.2)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiParam({ name: 'userRoleId', description: 'UserRole UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Role assignment revoked successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Cannot revoke your own roles (U14/9.1)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Role assignment not found',
  })
  async revokeRole(
    @Param('userRoleId') userRoleId: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    await this.userRolesService.revokeRole(userRoleId, currentUser?.userId);
    return {
      success: true,
      message: 'Role assignment revoked successfully.',
    };
  }
}

@ApiTags('Authorization - Roles')
@ApiBearerAuth('JWT')
@Controller('authorization/roles')
export class RolesController {
  constructor(private readonly userRolesService: UserRolesService) {}

  @Get()
  @RequirePermissions(USER_PERMISSIONS.VIEW)
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Get all active master roles' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of master roles retrieved',
  })
  async findAll() {
    return this.userRolesService.findAllRoles();
  }
}
