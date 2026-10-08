/**
 * Salary & Grade — Deployment Model Constants
 */

export const DEPLOYMENT_MODEL_PERMISSIONS = {
  VIEW: 'SALARY_GRADE.DEPLOYMENT_MODEL.VIEW',
} as const;

export type DeploymentModelPermission =
  (typeof DEPLOYMENT_MODEL_PERMISSIONS)[keyof typeof DEPLOYMENT_MODEL_PERMISSIONS];

export const DEPLOYMENT_MODEL_ERROR_CODES = {
  DEPLOYMENT_MODEL_NOT_FOUND:
    'DEPLOYMENT_MODEL_NOT_FOUND',
} as const;

export type DeploymentModelErrorCode =
  (typeof DEPLOYMENT_MODEL_ERROR_CODES)[keyof typeof DEPLOYMENT_MODEL_ERROR_CODES];