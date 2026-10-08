import { Module } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { OrganizationModule } from '../../organization/organization.module';

import { GradesController } from './controllers/grades.controller';
import { GradesRepository } from './repositories/grades.repository';
import { GradesService } from './services/grades.service';

@Module({
  imports: [
    AuthModule,
    OrganizationModule,
  ],

  controllers: [
    GradesController,
  ],

  providers: [
    GradesService,
    GradesRepository,
  ],

  exports: [
    GradesService,
    GradesRepository,
  ],
})
export class GradesModule {}