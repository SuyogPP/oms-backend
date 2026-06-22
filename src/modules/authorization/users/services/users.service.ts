import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UsersService {
    constructor(
        private readonly usersRepository: UsersRepository,
    ) { }

    async findAll() {
        return this.usersRepository.findAll();
    }
    async create(
        dto: CreateUserDto,
    ) {
        return this.usersRepository.create(dto);
    }

    async update(
        userId: string,
        dto: UpdateUserDto,
    ) {
        return this.usersRepository.update(
            userId,
            dto
        );
    }
}
