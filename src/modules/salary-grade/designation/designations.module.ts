import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { OrganizationModule } from '../../organization/organization.module';

import { DesignationsController } from './controllers/designations.controller';
import { DesignationsRepository } from './repositories/designations.repository';
import { DesignationsService } from './services/designations.service';

@Module({
  imports: [
    AuthModule,
    OrganizationModule,
  ],

  controllers: [
    DesignationsController,
  ],

  providers: [
    DesignationsService,
    DesignationsRepository,
  ],

  exports: [
    DesignationsService,
    DesignationsRepository,
  ],
})
export class DesignationsModule {}