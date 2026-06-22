import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';

@Controller('users')
export class UsersController {
    constructor(
        @Inject(UsersService)
        private readonly usersService: UsersService,
    ) { }



    @Get('test-db')
    async testDb() {
        const result = await this.usersService.testConnection();

        return {
            message: 'Database connection successful',
            serverTime: result[0].serverTime,
        };
    }

    @Post()
    async create(
        @Body() dto: CreateUserDto,
    ) {
        return this.usersService.create(dto);
    }
}
