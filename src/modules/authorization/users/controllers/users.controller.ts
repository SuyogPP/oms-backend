import { Controller, Get } from '@nestjs/common';
import { UsersService } from '../services/users.service';

@Controller('authorization/users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    async findAll() {
        return this.usersService.findAll();
    }
}