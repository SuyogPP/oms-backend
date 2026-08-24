import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../../common/common.module';
import { UsersController } from './controllers/users.controller';
import { UserCredentialsController } from './controllers/user-credentials.controller';
import { UsersService } from './services/users.service';
import { UserLifecycleService } from './services/user-lifecycle.service';
import { UserCredentialsService } from './services/user-credentials.service';
import { UserValidationService } from './services/user-validation.service';
import { UsersRepository } from './repositories/users.repository';
import { UserProfilesRepository } from './repositories/user-profiles.repository';
import { UserInvitationsRepository } from './repositories/user-invitations.repository';
import { PasswordHistoryRepository } from './repositories/password-history.repository';
import { UsersMapper } from './users.mapper';

import { UserAssignmentsModule } from '../user-assignments/user-assignments.module';
import { DelegationsModule } from '../delegations/delegations.module';
import { SecurityEventsModule } from '../../security-events/security-events.module';
import { AuditModule } from '../../audit/audit.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => UserAssignmentsModule),
    forwardRef(() => DelegationsModule),
    SecurityEventsModule,
    AuditModule,
    CommonModule,
  ],
  controllers: [UsersController, UserCredentialsController],
  providers: [
    // Repositories
    UsersRepository,
    UserProfilesRepository,
    UserInvitationsRepository,
    PasswordHistoryRepository,

    // Mappers
    UsersMapper,

    // Services
    UserValidationService,
    UsersService,
    UserLifecycleService,
    UserCredentialsService,
  ],
  exports: [
    UsersRepository,
    UserProfilesRepository,
    UserInvitationsRepository,
    PasswordHistoryRepository,
    UsersService,
    UserLifecycleService,
    UserCredentialsService,
    UserValidationService,
  ],
})
export class UsersModule {}
