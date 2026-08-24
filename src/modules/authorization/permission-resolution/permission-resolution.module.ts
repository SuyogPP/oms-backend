import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../../common/common.module';
import { PermissionResolutionController } from './controllers/permission-resolution.controller';
import { EffectivePermissionsService } from './services/effective-permissions.service';
import { RoleHierarchyService } from './services/role-hierarchy.service';
import { PermissionResolutionRepository } from './repositories/permission-resolution.repository';
import { PermissionResolutionMapper } from './permission-resolution.mapper';

/**
 * Domain 3 — Permission Resolution Submodule
 *
 * Encapsulates the 6-layer permission resolution engine, cycle-guarded recursive CTE
 * role hierarchy traversal, temporal validation, revoke-beats-grant enforcement,
 * and request-scoped caching.
 */
@Module({
  imports: [forwardRef(() => AuthModule), CommonModule],
  controllers: [PermissionResolutionController],
  providers: [
    PermissionResolutionRepository,
    PermissionResolutionMapper,
    RoleHierarchyService,
    EffectivePermissionsService,
  ],
  exports: [
    PermissionResolutionRepository,
    RoleHierarchyService,
    EffectivePermissionsService,
  ],
})
export class PermissionResolutionModule {}
