/**
 * Domain 2 — Organization Structure Constants
 */

// =============================================================================
// Permission Codes
// =============================================================================
export const ORG_PERMISSIONS = {
  VIEW: 'ORG.VIEW',
  CREATE: 'ORG.CREATE',
  UPDATE: 'ORG.UPDATE',
  MOVE: 'ORG.MOVE',
  DELETE: 'ORG.DELETE',
  MANAGER_ASSIGN: 'ORG.MANAGER.ASSIGN',
  TYPE_MANAGE: 'ORG.TYPE.MANAGE',
  EXPORT: 'ORG.EXPORT',
} as const;

export type OrgPermission =
  (typeof ORG_PERMISSIONS)[keyof typeof ORG_PERMISSIONS];

// =============================================================================
// Org Unit Type IDs
// =============================================================================
export const ORG_UNIT_TYPE_IDS = {
  ORGANIZATION: 1,
  BUSINESS_UNIT: 2,
  DEPARTMENT: 3,
  SECTION: 4,
} as const;

export type OrgUnitTypeId =
  (typeof ORG_UNIT_TYPE_IDS)[keyof typeof ORG_UNIT_TYPE_IDS];

export const ORG_UNIT_TYPE_CODES = {
  ORGANIZATION: 'ORGANIZATION',
  BUSINESS_UNIT: 'BUSINESS_UNIT',
  DEPARTMENT: 'DEPARTMENT',
  SECTION: 'SECTION',
} as const;

export type OrgUnitTypeCode =
  (typeof ORG_UNIT_TYPE_CODES)[keyof typeof ORG_UNIT_TYPE_CODES];

// =============================================================================
// Scope Level Codes (Maps to auth.ScopeDefinitions)
// =============================================================================
export const ORG_SCOPE_LEVEL_CODES = {
  GLOBAL: 'GLOBAL',
  ORGANIZATION: 'ORGANIZATION',
  BUSINESS_UNIT: 'BUSINESS_UNIT',
  DEPARTMENT: 'DEPARTMENT',
  SECTION: 'SECTION',
} as const;

export type OrgScopeLevelCode =
  (typeof ORG_SCOPE_LEVEL_CODES)[keyof typeof ORG_SCOPE_LEVEL_CODES];

// =============================================================================
// Manager Roles
// =============================================================================
export const ORG_MANAGER_ROLES = {
  HEAD: 'HEAD',
  DEPUTY: 'DEPUTY',
  ACTING: 'ACTING',
} as const;

export type OrgManagerRole =
  (typeof ORG_MANAGER_ROLES)[keyof typeof ORG_MANAGER_ROLES];

// =============================================================================
// Change Log Action Types
// =============================================================================
export const ORG_CHANGE_TYPES = {
  CREATED: 'CREATED',
  RENAMED: 'RENAMED',
  MOVED: 'MOVED',
  ACTIVATED: 'ACTIVATED',
  DEACTIVATED: 'DEACTIVATED',
  DELETED: 'DELETED',
  RESTORED: 'RESTORED',
  HEAD_ASSIGNED: 'HEAD_ASSIGNED',
  HEAD_ENDED: 'HEAD_ENDED',
  ATTRIBUTES_UPDATED: 'ATTRIBUTES_UPDATED',
} as const;

export type OrgChangeType =
  (typeof ORG_CHANGE_TYPES)[keyof typeof ORG_CHANGE_TYPES];

// =============================================================================
// Section 7 Domain Business Rule Error Codes
// =============================================================================
export const ORG_ERROR_CODES = {
  // 7.1 Creation
  ORG_TYPE_INVALID: 'ORG_TYPE_INVALID',
  ORG_PARENT_REQUIRED: 'ORG_PARENT_REQUIRED',
  ORG_ROOT_CANNOT_HAVE_PARENT: 'ORG_ROOT_CANNOT_HAVE_PARENT',
  ORG_ROOT_EXISTS: 'ORG_ROOT_EXISTS',
  ORG_HIERARCHY_RULE_VIOLATION: 'ORG_HIERARCHY_RULE_VIOLATION',
  ORG_PARENT_INACTIVE: 'ORG_PARENT_INACTIVE',
  ORG_CODE_DUPLICATE: 'ORG_CODE_DUPLICATE',
  ORG_CODE_FORMAT: 'ORG_CODE_FORMAT',
  ORG_EFFECTIVE_BEFORE_PARENT: 'ORG_EFFECTIVE_BEFORE_PARENT',
  ORG_SCOPE_DENIED: 'ORG_SCOPE_DENIED',

  // 7.2 Move
  ORG_PARENT_INVALID: 'ORG_PARENT_INVALID',
  ORG_MOVE_TO_SELF: 'ORG_MOVE_TO_SELF',
  ORG_MOVE_CYCLE: 'ORG_MOVE_CYCLE',
  ORG_MOVE_BLOCKED_BUDGET: 'ORG_MOVE_BLOCKED_BUDGET',
  ORG_CONCURRENCY_CONFLICT: 'ORG_CONCURRENCY_CONFLICT',

  // 7.3 Deactivate / Delete
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  ORG_HAS_ACTIVE_CHILDREN: 'ORG_HAS_ACTIVE_CHILDREN',
  ORG_HAS_CHILDREN: 'ORG_HAS_CHILDREN',
  ORG_HAS_ASSIGNED_USERS: 'ORG_HAS_ASSIGNED_USERS',
  ORG_REFERENCED: 'ORG_REFERENCED',
  ORG_ROOT_PROTECTED: 'ORG_ROOT_PROTECTED',

  // 7.4 Managers
  ORG_PRIMARY_HEAD_EXISTS: 'ORG_PRIMARY_HEAD_EXISTS',
  ORG_MANAGER_PERIOD_OVERLAP: 'ORG_MANAGER_PERIOD_OVERLAP',
  ORG_MANAGER_INVALID_USER: 'ORG_MANAGER_INVALID_USER',
  ORG_TYPE_NO_MANAGER: 'ORG_TYPE_NO_MANAGER',
  ORG_MANAGER_NOT_FOUND: 'ORG_MANAGER_NOT_FOUND',
} as const;

export type OrgErrorCode =
  (typeof ORG_ERROR_CODES)[keyof typeof ORG_ERROR_CODES];

// Code Regex validation: starts with alphanumeric, contains alphanumeric, underscores, hyphens, length 2-50
export const ORG_CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{1,49}$/;
