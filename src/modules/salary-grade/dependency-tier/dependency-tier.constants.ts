/**
 * Salary & Grade — Dependency Tier Master Constants
 */

// =============================================================================
// Permission Codes
// =============================================================================

export const DEPENDENCY_TIER_PERMISSIONS = {
  VIEW: 'SALARY_GRADE.DEPENDENCY_TIER.VIEW',
  CREATE: 'SALARY_GRADE.DEPENDENCY_TIER.CREATE',
  UPDATE: 'SALARY_GRADE.DEPENDENCY_TIER.UPDATE',
  DELETE: 'SALARY_GRADE.DEPENDENCY_TIER.DELETE',
} as const;

export type DependencyTierPermission =
  (typeof DEPENDENCY_TIER_PERMISSIONS)[keyof typeof DEPENDENCY_TIER_PERMISSIONS];

// =============================================================================
// Error Codes
// =============================================================================

export const DEPENDENCY_TIER_ERROR_CODES = {
  DEPENDENCY_TIER_NOT_FOUND:
    'DEPENDENCY_TIER_NOT_FOUND',

  DEPENDENCY_TIER_CODE_DUPLICATE:
    'DEPENDENCY_TIER_CODE_DUPLICATE',

  DEPENDENCY_TIER_CREATE_FAILED:
    'DEPENDENCY_TIER_CREATE_FAILED',

  DEPENDENCY_TIER_UPDATE_FAILED:
    'DEPENDENCY_TIER_UPDATE_FAILED',

  DEPENDENCY_TIER_DELETE_FAILED:
    'DEPENDENCY_TIER_DELETE_FAILED',
} as const;

export type DependencyTierErrorCode =
  (typeof DEPENDENCY_TIER_ERROR_CODES)[keyof typeof DEPENDENCY_TIER_ERROR_CODES];

// =============================================================================
// Default Values
// =============================================================================

export const DEPENDENCY_TIER_DEFAULTS = {
  IS_ACTIVE: true,
  IS_DELETED: false,
  PAGE: 1,
  PAGE_SIZE: 20,
} as const;