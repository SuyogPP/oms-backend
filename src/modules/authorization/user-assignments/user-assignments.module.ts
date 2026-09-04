import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../../common/common.module';
import { UsersModule } from '../users/users.module';
import { SecurityEventsModule } from '../../security-events/security-events.module';
import { AuditModule } from '../../audit/audit.module';
import {
  UserRolesController,
  RolesController,
} from './controllers/user-roles.controller';
import { UserScopesController } from './controllers/user-scopes.controller';
import { UserOverridesController } from './controllers/user-overrides.controller';
import { UserRolesService } from './services/user-roles.service';
import { UserScopesService } from './services/user-scopes.service';
import { UserOverridesService } from './services/user-overrides.service';
import { UserRolesRepository } from './repositories/user-roles.repository';
import { UserScopesRepository } from './repositories/user-scopes.repository';
import { UserOverridesRepository } from './repositories/user-overrides.repository';
import { UserAssignmentsMapper } from './user-assignments.mapper';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    SecurityEventsModule,
    AuditModule,
    CommonModule,
  ],
  controllers: [
    UserRolesController,
    RolesController,
    UserScopesController,
    UserOverridesController,
  ],
  providers: [
    // Repositories
    UserRolesRepository,
    UserScopesRepository,
    UserOverridesRepository,

    // Mapper
    UserAssignmentsMapper,

    // Services
    UserRolesService,
    UserScopesService,
    UserOverridesService,
  ],
  exports: [
    UserRolesRepository,
    UserScopesRepository,
    UserOverridesRepository,
    UserRolesService,
    UserScopesService,
    UserOverridesService,
  ],
})
export class UserAssignmentsModule {}
