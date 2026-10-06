import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { OrganizationModule } from '../../organization/organization.module';

import { DependencyTiersController } from './controllers/dependency-tiers.controller';
import { DependencyTiersRepository } from './repositories/dependency-tiers.repository';
import { DependencyTiersService } from './services/dependency-tiers.service';

@Module({
  imports: [
    AuthModule,
    OrganizationModule,
  ],

  controllers: [
    DependencyTiersController,
  ],

  providers: [
    DependencyTiersService,
    DependencyTiersRepository,
  ],

  exports: [
    DependencyTiersService,
    DependencyTiersRepository,
  ],
})
export class DependencyTiersModule {}