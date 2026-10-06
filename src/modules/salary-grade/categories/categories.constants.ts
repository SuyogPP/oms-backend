/**
 * Salary & Grade — Category Master Constants
 */

// =============================================================================
// Permission Codes
// =============================================================================

export const CATEGORY_PERMISSIONS = {
  VIEW: 'SALARY_GRADE.CATEGORY.VIEW',
  CREATE: 'SALARY_GRADE.CATEGORY.CREATE',
  UPDATE: 'SALARY_GRADE.CATEGORY.UPDATE',
  DELETE: 'SALARY_GRADE.CATEGORY.DELETE',
} as const;

export type CategoryPermission =
  (typeof CATEGORY_PERMISSIONS)[keyof typeof CATEGORY_PERMISSIONS];

// =============================================================================
// Error Codes
// =============================================================================

export const CATEGORY_ERROR_CODES = {
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',

  CATEGORY_CODE_DUPLICATE:
    'CATEGORY_CODE_DUPLICATE',

  CATEGORY_CREATE_FAILED:
    'CATEGORY_CREATE_FAILED',

  CATEGORY_UPDATE_FAILED:
    'CATEGORY_UPDATE_FAILED',

  CATEGORY_DELETE_FAILED:
    'CATEGORY_DELETE_FAILED',
} as const;

export type CategoryErrorCode =
  (typeof CATEGORY_ERROR_CODES)[keyof typeof CATEGORY_ERROR_CODES];

// =============================================================================
// Default Values
// =============================================================================

export const CATEGORY_DEFAULTS = {
  IS_ACTIVE: true,
  IS_DELETED: false,
  PAGE: 1,
  PAGE_SIZE: 10,
} as const;