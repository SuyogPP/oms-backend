import { Body, Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';

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


    @Delete(':id')
    async remove(
        @Param('id') id: string,
    ) {
        return this.usersService.remove(id);
    }
}