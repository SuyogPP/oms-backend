import {
  EffectivePermissionItem,
  RevokedPermissionItem,
  EffectivePermissionsResponse,
  RawPermissionRow,
  RawOverrideRow,
  RawDelegationRow,
} from './interfaces/permission-resolution.interface';
import { PERMISSION_SOURCES } from './permission-resolution.constants';

export class PermissionResolutionMapper {
  /**
   * Combines and transforms raw SQL data layers into the structured audit preview model.
   * Enforces REVOKE-BEATS-GRANT: any permission present in revokeOverrides is strictly excluded from permissions.
   */
  static toPreviewModel(
    rolePermissions: RawPermissionRow[],
    overrides: RawOverrideRow[],
    delegations: RawDelegationRow[],
  ): EffectivePermissionsResponse {
    const revokedMap = new Map<string, RevokedPermissionItem>();
    const effectiveMap = new Map<string, EffectivePermissionItem>();

    const formatDate = (d?: Date | null): string | undefined => {
      if (!d) return undefined;
      const iso = d.toISOString();
      return iso.endsWith('T00:00:00.000Z') ? iso.split('T')[0] : iso;
    };

    // 1. Process Revoke Overrides (IsGranted = 0)
    for (const ov of overrides) {
      if (!ov.isGranted) {
        revokedMap.set(ov.permissionCode, {
          code: ov.permissionCode,
          source: PERMISSION_SOURCES.OVERRIDE_REVOKE,
          ...(ov.reason ? { reason: ov.reason } : {}),
        });
      }
    }

    // 2. Process Role Permissions (Direct and Inherited)
    for (const rp of rolePermissions) {
      if (revokedMap.has(rp.permissionCode)) {
        continue; // Revoke beats grant
      }

      if (!effectiveMap.has(rp.permissionCode)) {
        const isInherited = rp.depth > 0;
        effectiveMap.set(rp.permissionCode, {
          code: rp.permissionCode,
          source: isInherited
            ? PERMISSION_SOURCES.ROLE_INHERITED
            : PERMISSION_SOURCES.ROLE,
          via: isInherited ? rp.inheritedVia || rp.roleCode : rp.roleCode,
        });
      }
    }

    // 3. Process Grant Overrides (IsGranted = 1)
    for (const ov of overrides) {
      if (ov.isGranted && !revokedMap.has(ov.permissionCode)) {
        const until = formatDate(ov.effectiveTo);
        effectiveMap.set(ov.permissionCode, {
          code: ov.permissionCode,
          source: PERMISSION_SOURCES.OVERRIDE_GRANT,
          ...(ov.reason ? { reason: ov.reason } : {}),
          ...(until ? { until } : {}),
        });
      }
    }

    // 4. Process Delegations
    for (const del of delegations) {
      if (del.permissionCode && !revokedMap.has(del.permissionCode)) {
        if (!effectiveMap.has(del.permissionCode)) {
          const until = formatDate(del.endDate);
          effectiveMap.set(del.permissionCode, {
            code: del.permissionCode,
            source: PERMISSION_SOURCES.DELEGATION,
            ...(del.fromUserName ? { via: del.fromUserName } : {}),
            ...(del.reason ? { reason: del.reason } : {}),
            ...(until ? { until } : {}),
          });
        }
      }
    }

    return {
      permissions: Array.from(effectiveMap.values()).sort((a, b) =>
        a.code.localeCompare(b.code),
      ),
      revoked: Array.from(revokedMap.values()).sort((a, b) =>
        a.code.localeCompare(b.code),
      ),
    };
  }
}
