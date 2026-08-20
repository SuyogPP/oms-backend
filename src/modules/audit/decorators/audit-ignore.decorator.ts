import { SetMetadata } from '@nestjs/common';

export const AUDIT_IGNORE_KEY = 'AUDIT_IGNORE';

/**
 * Decorator to skip audit logging for specific endpoints (health checks, polling, etc.).
 */
export const AuditIgnore = () => SetMetadata(AUDIT_IGNORE_KEY, true);
