import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SecurityEventsModule } from '../security-events/security-events.module';
import { SecurityModule } from '../security/security.module';
import { RetentionController } from './controllers/retention.controller';
import { RetentionRepository } from './repositories/retention.repository';
import { RetentionService } from './services/retention.service';

@Module({
  imports: [AuthModule, SecurityModule, SecurityEventsModule],
  controllers: [RetentionController],
  providers: [RetentionService, RetentionRepository],
  exports: [RetentionService, RetentionRepository],
})
export class RetentionModule {}
