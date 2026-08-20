import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { PERMISSIONS } from 'src/common/constants/permissions';
import { PermissionGuard } from 'src/modules/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/auth/decorators/permissions.decorator';

import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

/**
 * UsersController handles incoming HTTP requests related to user management.
 * All endpoints under this controller are protected and require the USER_MANAGE permission.
 */
@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('authorization/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Retrieves all users.
   * @returns A list of users
   */
  @Get()
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @UseGuards(PermissionGuard)
  async findAll() {
    return this.usersService.findAll();
  }

  /**
   * Creates a new user.
   * @param dto Data transfer object containing user details
   * @returns The created user object
   */
  @Post()
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @UseGuards(PermissionGuard)
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  /**
   * Deletes a user by their ID.
   * @param id The unique identifier of the user to delete
   * @returns A success message or deleted result
   */
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @UseGuards(PermissionGuard)
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
