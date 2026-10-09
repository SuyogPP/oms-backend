import { Module } from '@nestjs/common';

import {
  AuthModule,
} from '../../auth/auth.module';

import {
  OrganizationModule,
} from '../../organization/organization.module';

import {
  GradeBenefitsController,
} from './controllers/grade-benefits.controller';

import {
  GradeBenefitsRepository,
} from './repositories/grade-benefits.repository';

import {
  GradeBenefitsService,
} from './services/grade-benefits.service';

@Module({
  imports: [
    AuthModule,
    OrganizationModule,
  ],

  controllers: [
    GradeBenefitsController,
  ],

  providers: [
    GradeBenefitsService,
    GradeBenefitsRepository,
  ],

  exports: [
    GradeBenefitsService,
    GradeBenefitsRepository,
  ],
})
export class GradeBenefitModule {}