import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { OrganizationModule } from '../../organization/organization.module';

import { DeploymentModelsController } from './controllers/deployment-models.controller';

import { DeploymentModelsRepository } from './repositories/deployment-models.repository';

import { DeploymentModelsService } from './services/deployment-models.service';

@Module({
  imports: [
    AuthModule,
    OrganizationModule,
  ],

  controllers: [
    DeploymentModelsController,
  ],

  providers: [
    DeploymentModelsService,
    DeploymentModelsRepository,
  ],

  exports: [
    DeploymentModelsService,
    DeploymentModelsRepository,
  ],
})
export class DeploymentModelsModule {}