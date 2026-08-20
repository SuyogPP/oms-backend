import { Module, Global } from '@nestjs/common';
import { SecurityEventsRepository } from './repositories/security-events.repository';
import { SecurityEventsService } from './services/security-events.service';
import { RequestContextService } from '../../common/services/request-context.service';

@Global()
@Module({
  providers: [
    RequestContextService,
    SecurityEventsRepository,
    SecurityEventsService,
  ],
  exports: [SecurityEventsService, SecurityEventsRepository],
})
export class SecurityEventsModule {}
