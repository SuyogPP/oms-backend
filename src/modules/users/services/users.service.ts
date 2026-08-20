import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { AuditService } from 'src/modules/audit/service/audit.services';

/**
 * UsersService provides business logic for user management operations.
 * It interacts with the UsersRepository to persist data and AuditService for logging.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Fetches all users from the database.
   */
  async findAll() {
    return this.usersRepository.findAll();
  }

  /**
   * Creates a new user in the database.
   * @param dto The data transfer object containing new user details
   */
  async create(dto: CreateUserDto) {
    const result = await this.usersRepository.create(dto);

    // TODO: Uncomment once audit service is fully implemented
    // if (result.success) {
    //     await this.auditService.logUserCreated({
    //         userId: result.data!.userId,
    //         username: dto.username,
    //         email: dto.email,
    //     });
    // }

    return result;
  }

  /**
   * Removes a user from the database.
   * @param id The ID of the user to delete
   */
  async remove(id: string) {
    const result = await this.usersRepository.remove(id);

    // TODO: Uncomment once audit service is fully implemented
    // if (result.success) {
    //     await this.auditService.logUserDeleted({
    //         userId: id,
    //     });
    // }

    if (result.success) {
      await this.auditService.logUserDeletedChange({
        userId: id,
      });
    }

    return result;
  }
}
