/**
 * Constants for the Permission Resolution submodule.
 */

export const MAX_ROLE_HIERARCHY_DEPTH = 10;

export const PERMISSION_SOURCES = {
  ROLE: 'ROLE',
  ROLE_INHERITED: 'ROLE_INHERITED',
  OVERRIDE_GRANT: 'OVERRIDE_GRANT',
  DELEGATION: 'DELEGATION',
  OVERRIDE_REVOKE: 'OVERRIDE_REVOKE',
} as const;

export type PermissionSourceType =
  (typeof PERMISSION_SOURCES)[keyof typeof PERMISSION_SOURCES];

export const CACHE_PREFIX = 'effective_perms:';
