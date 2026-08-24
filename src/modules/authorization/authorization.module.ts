import { Module } from '@nestjs/common';
import { PermissionResolutionModule } from './permission-resolution/permission-resolution.module';
import { UsersModule } from './users/users.module';
import { UserAssignmentsModule } from './user-assignments/user-assignments.module';
import { DelegationsModule } from './delegations/delegations.module';
import { VendorUsersModule } from './vendor-users/vendor-users.module';
import { UserImportModule } from './user-import/user-import.module';

/**
 * Domain 3 — Authorization Root Module
 *
 * Encapsulates the entire Domain 3 User Administration & Authorization capability:
 * - Permission Resolution Engine (§4)
 * - User Administration & Credentials Lifecycle (§5)
 * - Scope & Role Assignments (§6)
 * - Vendor User Management (§7)
 * - Delegations Management (§9)
 * - Bulk Import Validation & Commit (§8)
 */
@Module({
  imports: [
    PermissionResolutionModule,
    UsersModule,
    UserAssignmentsModule,
    DelegationsModule,
    VendorUsersModule,
    UserImportModule,
  ],
  exports: [
    PermissionResolutionModule,
    UsersModule,
    UserAssignmentsModule,
    DelegationsModule,
    VendorUsersModule,
    UserImportModule,
  ],
})
export class AuthorizationModule {}
