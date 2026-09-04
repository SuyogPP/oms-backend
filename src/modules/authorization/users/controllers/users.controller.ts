import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
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
import { UsersService } from '../services/users.service';
import { UserLifecycleService } from '../services/user-lifecycle.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserFilterDto } from '../dto/user-filter.dto';
import {
  UserEntity,
  UserListResponseEntity,
  UserActivityEntity,
} from '../entities/user.entity';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { USER_PERMISSIONS } from '../users.constants';

@ApiTags('Authorization - Users')
@ApiBearerAuth('JWT')
@Controller('authorization/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userLifecycleService: UserLifecycleService,
  ) {}

  @Get()
  @RequirePermissions(USER_PERMISSIONS.VIEW)
  @UseGuards(PermissionGuard)
  @ApiOperation({
    summary:
      'List users with pagination, sorting, filters, and scope enforcement',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated user list retrieved successfully',
    type: UserListResponseEntity,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid JWT token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Missing USER.VIEW permission',
  })
  async findAll(
    @Query() filter: UserFilterDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ): Promise<UserListResponseEntity> {
    return this.usersService.findAll(filter, currentUser?.userId);
  }

  @Get('export')
  @RequirePermissions(USER_PERMISSIONS.EXPORT)
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Export user records for CSV/JSON download' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Export dataset generated successfully',
    type: [UserEntity],
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Missing USER.EXPORT permission',
  })
  async exportUsers(
    @Query() filter: UserFilterDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ): Promise<UserEntity[]> {
    return this.usersService.exportUsers(filter, currentUser?.userId);
  }

  @Get(':id')
  @RequirePermissions(USER_PERMISSIONS.VIEW)
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Get user details by ID with scope validation' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User details retrieved',
    type: UserEntity,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found or out of scope',
  })
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ): Promise<UserEntity> {
    return this.usersService.findById(id, currentUser?.userId);
  }

  @Post()
  @RequirePermissions(USER_PERMISSIONS.CREATE)
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Create a new user and generate invitation token' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User created successfully and invitation issued',
    type: UserEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email or username already exists',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Creator scope does not cover department',
  })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.usersService.create(dto, currentUser?.userId);
  }

  @Patch(':id')
  @RequirePermissions(USER_PERMISSIONS.UPDATE)
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Update user and profile information' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
    type: UserEntity,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found or out of scope',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email or username conflict',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ): Promise<UserEntity> {
    return this.usersService.update(id, dto, currentUser?.userId);
  }

  @Post(':id/activate')
  @RequirePermissions(USER_PERMISSIONS.DEACTIVATE)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate an inactive user account' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User activated successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async activate(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    await this.userLifecycleService.activate(id, currentUser?.userId);
    return { success: true, message: 'User activated successfully.' };
  }

  @Post(':id/deactivate')
  @RequirePermissions(USER_PERMISSIONS.DEACTIVATE)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate a user account and revoke active sessions',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User deactivated successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Self-deactivation or last admin guard triggered',
  })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    await this.userLifecycleService.deactivate(id, currentUser?.userId);
    return { success: true, message: 'User deactivated successfully.' };
  }

  @Delete(':id')
  @RequirePermissions(USER_PERMISSIONS.DELETE)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Soft delete a user, revoke sessions, and terminate active roles & delegations',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User soft-deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Self-deletion, last admin, or primary unit head guard triggered',
  })
  async delete(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    await this.userLifecycleService.softDelete(id, currentUser?.userId);
    return { success: true, message: 'User deleted successfully.' };
  }

  @Get(':id/activity')
  @RequirePermissions(USER_PERMISSIONS.VIEW)
  @UseGuards(PermissionGuard)
  @ApiOperation({
    summary: 'Get security and authentication event history for a user',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User activity log retrieved',
    type: [UserActivityEntity],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found or out of scope',
  })
  async getActivity(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ): Promise<UserActivityEntity[]> {
    return this.usersService.getUserActivity(id, currentUser?.userId);
  }
}
