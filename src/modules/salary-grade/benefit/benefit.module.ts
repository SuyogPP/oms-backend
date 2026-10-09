import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { OrganizationModule } from '../../organization/organization.module';

import { BenefitsController } from './controllers/benefits.controller';
import { BenefitsRepository } from './repositories/benefits.repository';
import { BenefitsService } from './services/benefits.service';

@Module({
  imports: [
    AuthModule,
    OrganizationModule,
  ],

  controllers: [
    BenefitsController,
  ],

  providers: [
    BenefitsService,
    BenefitsRepository,
  ],

  exports: [
    BenefitsService,
    BenefitsRepository,
  ],
})
export class BenefitsModule {}