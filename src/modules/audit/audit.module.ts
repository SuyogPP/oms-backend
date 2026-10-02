import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from 'src/modules/audit/service/audit.services';
import { AuditRepository } from './repositories/audit.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { AuditInterceptor } from 'src/modules/audit/interceptor/audit.interceptor';

/**
 * AuditModule
 *
 * Provides two repositories:
 * - `AuditRepository`    — legacy cross-DB writes to OMS_Audit_DB (primary DataSource)
 * - `AuditLogRepository` — writes/reads for [dbo].[tbl_Audit_Log] in DIEZ-AUDIT-DB
 *
 * Export both so feature modules can inject them without re-declaring.
 */
@Module({
  providers: [
    AuditService,
    AuditRepository,
    AuditLogRepository,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService, AuditLogRepository],
})
export class AuditModule {}
