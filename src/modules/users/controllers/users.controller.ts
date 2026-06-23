import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';

@ApiTags('User Management')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
    constructor(
        @Inject(UsersService)
        private readonly usersService: UsersService,
    ) { }

    @Get('test-db')
    @ApiOperation({ summary: 'Test Database Connection' })
    @ApiResponse({ status: 200, description: 'Database connection successful' })
    async testDb() {
        const result = await this.usersService.testConnection();

        return {
            message: 'Database connection successful',
            serverTime: result[0].serverTime,
        };
    }



    @Post()
    @ApiOperation({ summary: 'Create a new user' })
    @ApiResponse({ status: 201, description: 'User created successfully' })
    @ApiUnauthorizedResponse({ description: 'Unauthorized' })
    @ApiForbiddenResponse({ description: 'Forbidden' })
    async create(
        @Body() dto: CreateUserDto,
    ) {
        return this.usersService.create(dto);
    }


}
