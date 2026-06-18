import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersRepository {
    async findAll() {
        return [];
    }
}