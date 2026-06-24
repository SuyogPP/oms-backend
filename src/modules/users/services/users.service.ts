import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { AuditService } from 'src/modules/audit/service/audit.services';

@Injectable()
export class UsersService {
    constructor(
        private readonly usersRepository: UsersRepository,
        private readonly auditService: AuditService,
    ) {}

    async findAll() {
        return this.usersRepository.findAll();
    }

    async create(dto: CreateUserDto) {
        const result = await this.usersRepository.create(dto);

        // if (result.success) {
        //     await this.auditService.logUserCreated({
        //         userId: result.data!.userId,
        //         username: dto.username,
        //         email: dto.email,
        //     });
        // }

        return result;
    }

    async remove(id: string) {
        const result = await this.usersRepository.remove(id);

        // if (result.success) {
        //     await this.auditService.logUserDeleted({
        //         userId: id,
        //     });
        // }

        return result;
    }
}