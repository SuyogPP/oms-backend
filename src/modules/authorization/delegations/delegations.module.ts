import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../../common/common.module';
import { UsersModule } from '../users/users.module';
import { SecurityEventsModule } from '../../security-events/security-events.module';
import { AuditModule } from '../../audit/audit.module';
import { DelegationsController } from './controllers/delegations.controller';
import { DelegationsService } from './services/delegations.service';
import { DelegationsRepository } from './repositories/delegations.repository';
import { DelegationsMapper } from './delegations.mapper';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    SecurityEventsModule,
    AuditModule,
    CommonModule,
  ],
  controllers: [DelegationsController],
  providers: [DelegationsRepository, DelegationsMapper, DelegationsService],
  exports: [DelegationsRepository, DelegationsService],
})
export class DelegationsModule {}

