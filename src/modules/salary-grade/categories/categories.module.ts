import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { OrganizationModule } from '../../organization/organization.module';

import { CategoriesController } from './controllers/categories.controller';
import { CategoriesRepository } from './repositories/categories.repository';
import { CategoriesService } from './services/categories.service';

@Module({
  imports: [
    AuthModule,
    OrganizationModule,
  ],

  controllers: [
    CategoriesController,
  ],

  providers: [
    CategoriesService,
    CategoriesRepository,
  ],

  exports: [
    CategoriesService,
    CategoriesRepository,
  ],
})
export class CategoriesModule {}