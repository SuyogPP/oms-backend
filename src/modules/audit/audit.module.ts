import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from 'src/modules/audit/service/audit.services';
import { AuditRepository } from './repositories/audit.repository';
import { AuditInterceptor } from 'src/modules/audit/interceptor/audit.interceptor';

@Module({
  providers: [
    AuditService,
    AuditRepository,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}