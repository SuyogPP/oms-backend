import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { Patch, Param } from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto';

@Controller('authorization/users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    async findAll() {
        return this.usersService.findAll();
    }

    @Post()
    async create(
        @Body() dto: CreateUserDto,
    ) {
        return this.usersService.create(dto);
    }

    @Patch(':userId')
    async update(
        @Param('userId') userId: string,
        @Body() dto: UpdateUserDto,
    ) {
        return this.usersService.update(
            userId,
            dto
        );
    }
}