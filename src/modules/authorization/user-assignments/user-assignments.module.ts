import { UserOrgUnitAssignmentRepository } from '../../organization/org-units';
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
import { UserOverridesController } from './controllers/user-overrides.controller';
import { UserRolesService } from './services/user-roles.service';
import { UserOverridesService } from './services/user-overrides.service';
import { UserRolesRepository } from './repositories/user-roles.repository';
import { UserOverridesRepository } from './repositories/user-overrides.repository';
import { UserAssignmentsMapper } from './user-assignments.mapper';
import { OrganizationModule } from '../../organization/organization.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    forwardRef(() => OrganizationModule),
    SecurityEventsModule,
    AuditModule,
    CommonModule,
  ],
  controllers: [
    UserRolesController,
    RolesController,
    UserOverridesController,
  ],
  providers: [
    UserOrgUnitAssignmentRepository,
    // Repositories
    UserRolesRepository,
    UserOverridesRepository,

    // Mapper
    UserAssignmentsMapper,

    // Services
    UserRolesService,
    UserOverridesService,
  ],
  exports: [
    UserRolesRepository,
    UserOverridesRepository,
    UserRolesService,
    UserOverridesService,
  ],
})
export class UserAssignmentsModule {}
