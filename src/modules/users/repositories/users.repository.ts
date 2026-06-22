import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';


@Injectable()
export class UsersRepository {
    constructor(
        private readonly dataSource: DataSource,
    ) { }

    async testConnection() {
        const result = await this.dataSource.query(
            'SELECT GETDATE() AS serverTime',
        );

        return result;
    }

    async create(dto: CreateUserDto) {
        console.log(dto);

        return {
            message: 'Repository reached successfully',
            data: dto,
        };
    }

}