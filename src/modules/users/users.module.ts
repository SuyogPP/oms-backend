import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { UsersRepository } from './repositories/users.repository';
import { AuditModule } from '../audit/audit.module';

/**
 * UsersModule manages user accounts, registration, and user-specific operations.
 * Imports AuditModule to log user-related actions.
 */
@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}