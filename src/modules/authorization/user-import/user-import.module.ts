import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../../common/common.module';
import { UsersModule } from '../users/users.module';
import { SecurityEventsModule } from '../../security-events/security-events.module';
import { AuditModule } from '../../audit/audit.module';
import { UserImportController } from './controllers/user-import.controller';
import { UserImportService } from './services/user-import.service';
import { UserImportRepository } from './repositories/user-import.repository';
import { UserImportMapper } from './user-import.mapper';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    SecurityEventsModule,
    AuditModule,
    CommonModule,
  ],
  controllers: [UserImportController],
  providers: [UserImportRepository, UserImportMapper, UserImportService],
  exports: [UserImportRepository, UserImportService],
})
export class UserImportModule {}
