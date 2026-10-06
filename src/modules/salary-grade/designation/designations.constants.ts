/**
 * Salary & Grade — Designation Master Constants
 */

// =============================================================================
// Permission Codes
// =============================================================================

export const DESIGNATION_PERMISSIONS = {
  VIEW: 'SALARY_GRADE.DESIGNATION.VIEW',
  CREATE: 'SALARY_GRADE.DESIGNATION.CREATE',
  UPDATE: 'SALARY_GRADE.DESIGNATION.UPDATE',
  DELETE: 'SALARY_GRADE.DESIGNATION.DELETE',
} as const;

export type DesignationPermission =
  (typeof DESIGNATION_PERMISSIONS)[keyof typeof DESIGNATION_PERMISSIONS];

// =============================================================================
// Error Codes
// =============================================================================

export const DESIGNATION_ERROR_CODES = {
  DESIGNATION_NOT_FOUND: 'DESIGNATION_NOT_FOUND',

  DESIGNATION_CODE_DUPLICATE:
    'DESIGNATION_CODE_DUPLICATE',

  DESIGNATION_CREATE_FAILED:
    'DESIGNATION_CREATE_FAILED',

  DESIGNATION_UPDATE_FAILED:
    'DESIGNATION_UPDATE_FAILED',

  DESIGNATION_DELETE_FAILED:
    'DESIGNATION_DELETE_FAILED',
} as const;

export type DesignationErrorCode =
  (typeof DESIGNATION_ERROR_CODES)[keyof typeof DESIGNATION_ERROR_CODES];

// =============================================================================
// Default Values
// =============================================================================

export const DESIGNATION_DEFAULTS = {
  IS_ACTIVE: true,
  IS_DELETED: false,
  PAGE: 1,
  PAGE_SIZE: 20,
} as const;