import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { FiscalYearsController } from './controllers/fiscal-years.controller';
import { FiscalYearsService } from './services/fiscal-years.service';
import { FiscalYearsRepository } from './repositories/fiscal-years.repository';

@Module({
  imports: [AuditModule],
  controllers: [FiscalYearsController],
  providers: [FiscalYearsService, FiscalYearsRepository],
  exports: [FiscalYearsService, FiscalYearsRepository],
})
export class FiscalYearsModule {}
