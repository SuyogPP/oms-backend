/**
 * Salary & Grade — Grade Master Constants
 */

// =============================================================================
// Permission Codes
// =============================================================================

export const GRADE_PERMISSIONS = {
  VIEW: 'SALARY_GRADE.GRADE.VIEW',
  CREATE: 'SALARY_GRADE.GRADE.CREATE',
  UPDATE: 'SALARY_GRADE.GRADE.UPDATE',
  DELETE: 'SALARY_GRADE.GRADE.DELETE',
} as const;

export type GradePermission =
  (typeof GRADE_PERMISSIONS)[keyof typeof GRADE_PERMISSIONS];

// =============================================================================
// Error Codes
// =============================================================================

export const GRADE_ERROR_CODES = {
  GRADE_NOT_FOUND: 'GRADE_NOT_FOUND',

  GRADE_CODE_DUPLICATE:
    'GRADE_CODE_DUPLICATE',

  INVALID_SALARY_RANGE:
    'INVALID_SALARY_RANGE',

  GRADE_CREATE_FAILED:
    'GRADE_CREATE_FAILED',

  GRADE_UPDATE_FAILED:
    'GRADE_UPDATE_FAILED',

  GRADE_DELETE_FAILED:
    'GRADE_DELETE_FAILED',
} as const;

export type GradeErrorCode =
  (typeof GRADE_ERROR_CODES)[keyof typeof GRADE_ERROR_CODES];

// =============================================================================
// Default Values
// =============================================================================

export const GRADE_DEFAULTS = {
  IS_ACTIVE: true,
  IS_DELETE: false,
  PAGE: 1,
  PAGE_SIZE: 20,
} as const;