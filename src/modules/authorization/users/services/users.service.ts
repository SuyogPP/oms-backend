import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserDto } from '../dto/create-user.dto';
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
    async remove(id: string) {
    return this.usersRepository.remove(id);
}
}