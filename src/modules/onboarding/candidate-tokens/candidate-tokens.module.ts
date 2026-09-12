import { Module } from '@nestjs/common';
import { CandidateTokensController } from './controllers/candidate-tokens.controller';
import { CandidateTokensService } from './services/candidate-tokens.service';
import { CandidateTokensRepository } from './repositories/candidate-tokens.repository';

@Module({
  controllers: [CandidateTokensController],
  providers: [CandidateTokensService, CandidateTokensRepository],
  exports: [CandidateTokensService, CandidateTokensRepository],
})
export class CandidateTokensModule {}
