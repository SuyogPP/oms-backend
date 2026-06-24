import { Body, Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { PERMISSIONS } from 'src/common/constants/permissions';
import { UseGuards } from '@nestjs/common';
import { PermissionGuard} from 'src/modules/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/modules/auth/decorators/permissions.decorator';


@Controller('authorization/users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @RequirePermissions(PERMISSIONS.USER_MANAGE)
    @UseGuards(PermissionGuard)
    async findAll() {
        return this.usersService.findAll();
    }



    @Post()
    @RequirePermissions(PERMISSIONS.USER_MANAGE)
    @UseGuards(PermissionGuard)
    async create(
        @Body() dto: CreateUserDto,
    ) {
        return this.usersService.create(dto);
    }


    @Delete(':id')
    @RequirePermissions(PERMISSIONS.USER_MANAGE)
    @UseGuards(PermissionGuard)
    async remove(
        @Param('id') id: string,
    ) {
        return this.usersService.remove(id);
    }
}