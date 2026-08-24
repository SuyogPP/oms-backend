import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../../common/common.module';
import { UserImportController } from './controllers/user-import.controller';
import { UserImportService } from './services/user-import.service';
import { UserImportRepository } from './repositories/user-import.repository';
import { UserImportMapper } from './user-import.mapper';

@Module({
  imports: [forwardRef(() => AuthModule), CommonModule],
  controllers: [UserImportController],
  providers: [UserImportRepository, UserImportMapper, UserImportService],
  exports: [UserImportRepository, UserImportService],
})
export class UserImportModule {}
