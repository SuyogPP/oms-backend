import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CommonModule } from '../../../common/common.module';
import { VendorUsersController } from './controllers/vendor-users.controller';
import { VendorUsersService } from './services/vendor-users.service';
import { VendorUsersRepository } from './repositories/vendor-users.repository';
import { VendorUsersMapper } from './vendor-users.mapper';

@Module({
  imports: [forwardRef(() => AuthModule), CommonModule],
  controllers: [VendorUsersController],
  providers: [VendorUsersRepository, VendorUsersMapper, VendorUsersService],
  exports: [VendorUsersRepository, VendorUsersService],
})
export class VendorUsersModule {}
