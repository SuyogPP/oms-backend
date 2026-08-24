import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../../common/common.module';
import { DelegationsController } from './controllers/delegations.controller';
import { DelegationsService } from './services/delegations.service';
import { DelegationsRepository } from './repositories/delegations.repository';
import { DelegationsMapper } from './delegations.mapper';

@Module({
  imports: [forwardRef(() => AuthModule), CommonModule],
  controllers: [DelegationsController],
  providers: [DelegationsRepository, DelegationsMapper, DelegationsService],
  exports: [DelegationsRepository, DelegationsService],
})
export class DelegationsModule {}
