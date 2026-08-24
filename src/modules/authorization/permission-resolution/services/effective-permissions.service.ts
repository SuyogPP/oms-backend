import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RequestContextService } from '../../../../common/services/request-context.service';
import { PermissionResolutionRepository } from '../repositories/permission-resolution.repository';
import { PermissionResolutionMapper } from '../permission-resolution.mapper';
import { EffectivePermissionsResponse } from '../interfaces/permission-resolution.interface';
import { CACHE_PREFIX } from '../permission-resolution.constants';

@Injectable()
export class EffectivePermissionsService {
  private readonly logger = new Logger(EffectivePermissionsService.name);

  constructor(
    private readonly repository: PermissionResolutionRepository,
    private readonly requestContextService: RequestContextService,
  ) {}

  /**
   * Resolves the distinct list of effective permission codes for a user.
   *
   * Resolution Order (Spec §4.1):
   * 1. Active roles today (auth.UserRoles, temporal)
   * 2. + Roles via auth.RoleHierarchy (recursive CTE, cycle-guarded)
   * 3. -> Permissions via auth.RolePermissions
   * 4. + User overrides where IsGranted = 1
   * 5. - User overrides where IsGranted = 0 (REVOKE BEATS GRANT ALWAYS)
   * 6. + Active temporal delegations (auth.Delegations / auth.DelegationPermissions)
   *
   * Caching (§4.5): Cached exclusively within the active HTTP Request Context.
   * Never cached across requests to ensure immediate revocation.
   */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    if (!userId) {
      return [];
    }

    const cacheKey = `${CACHE_PREFIX}${userId}`;
    const cached =
      this.requestContextService.getCachedPermission<string[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Inactive or deleted user resolves to ZERO permissions
    const isActive = await this.repository.isUserActive(userId);
    if (!isActive) {
      this.requestContextService.setCachedPermission(cacheKey, []);
      return [];
    }

    // 1 & 2. Resolve Direct and Inherited Roles
    const roles = await this.repository.resolveUserRolesWithHierarchy(userId);

    // 3. Resolve Role Permissions
    const rolePermissions =
      await this.repository.resolvePermissionsForRoles(roles);

    // 4 & 5. Resolve User Overrides (Grants and Revokes)
    const overrides = await this.repository.resolveUserOverrides(userId);

    // 6. Resolve Active Delegations
    const delegations = await this.repository.resolveDelegations(userId);

    // Build Revoke Set (IsGranted = 0) - REVOKE WINS ALWAYS
    const revokeSet = new Set<string>();
    for (const ov of overrides) {
      if (!ov.isGranted) {
        revokeSet.add(ov.permissionCode);
      }
    }

    const effectiveSet = new Set<string>();

    // Add Role Permissions (filtered against Revoke Set)
    for (const rp of rolePermissions) {
      if (!revokeSet.has(rp.permissionCode)) {
        effectiveSet.add(rp.permissionCode);
      }
    }

    // Add Grant Overrides (IsGranted = 1, filtered against Revoke Set)
    for (const ov of overrides) {
      if (ov.isGranted && !revokeSet.has(ov.permissionCode)) {
        effectiveSet.add(ov.permissionCode);
      }
    }

    // Add Delegations (filtered against Revoke Set)
    for (const del of delegations) {
      if (del.permissionCode && !revokeSet.has(del.permissionCode)) {
        effectiveSet.add(del.permissionCode);
      }
    }

    const result = Array.from(effectiveSet);
    this.requestContextService.setCachedPermission(cacheKey, result);

    return result;
  }

  /**
   * Generates the detailed audit preview model for GET /users/:id/effective-permissions per Spec §4.6.
   * Includes the exact source (ROLE, ROLE_INHERITED, OVERRIDE_GRANT, DELEGATION),
   * inheritance path, justification reason, expiration timestamp, and revoked permissions.
   *
   * Scope Filtering (§9.2):
   * Inspecting a user outside requester's visible scope returns 404 (Not Found),
   * preventing reconnaissance of out-of-scope accounts.
   */
  async getEffectivePermissionsPreview(
    targetUserId: string,
    requesterUserId?: string,
  ): Promise<EffectivePermissionsResponse> {
    if (!targetUserId) {
      throw new NotFoundException('User not found');
    }

    // If requesterUserId is provided, enforce Layer 3 Scope check
    if (requesterUserId) {
      const inScope = await this.repository.isUserInScope(
        requesterUserId,
        targetUserId,
      );
      if (!inScope) {
        throw new NotFoundException('User not found');
      }
    } else {
      const isActive = await this.repository.isUserActive(targetUserId);
      if (!isActive) {
        throw new NotFoundException('User not found');
      }
    }

    const roles =
      await this.repository.resolveUserRolesWithHierarchy(targetUserId);
    const rolePermissions =
      await this.repository.resolvePermissionsForRoles(roles);
    const overrides =
      await this.repository.resolveUserOverrides(targetUserId);
    const delegations =
      await this.repository.resolveDelegations(targetUserId);

    return PermissionResolutionMapper.toPreviewModel(
      rolePermissions,
      overrides,
      delegations,
    );
  }

  /**
   * Verifies if a user possesses a specific permission code.
   * Note: SYSTEM_ADMIN bypasses permission checks (but not scope checks).
   */
  async hasPermission(
    userId: string,
    permissionCode: string,
  ): Promise<boolean> {
    if (!userId || !permissionCode) {
      return false;
    }

    // Inactive user check
    const isActive = await this.repository.isUserActive(userId);
    if (!isActive) {
      return false;
    }

    // Check if user holds SYSTEM_ADMIN role
    const roles = await this.repository.resolveUserRolesWithHierarchy(userId);
    const isSystemAdmin = roles.some((r) => r.roleCode === 'SYSTEM_ADMIN');
    if (isSystemAdmin) {
      return true;
    }

    const permissions = await this.getEffectivePermissions(userId);
    return permissions.includes(permissionCode);
  }
}
