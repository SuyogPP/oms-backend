import { Module, forwardRef } from '@nestjs/common';
import { SecurityChartsController } from './controllers/security-charts.controller';
import { SecurityDashboardController } from './controllers/security-dashboard.controller';
import { SecuritySettingsController } from './controllers/security-settings.controller';
import { SecurityRepository } from './repositories/security.repository';
import { SecuritySettingsRepository } from './repositories/security-settings.repository';
import { SecurityChartsService } from './services/security-charts.service';
import { SecurityDashboardService } from './services/security-dashboard.service';
import { SecuritySettingsService } from './services/security-settings.service';
import { AuthModule } from '../auth/auth.module';
import { SecurityEventsModule } from '../security-events/security-events.module';

@Module({
  imports: [forwardRef(() => AuthModule), SecurityEventsModule],
  controllers: [
    SecurityDashboardController,
    SecurityChartsController,
    SecuritySettingsController,
  ],
  providers: [
    SecurityRepository,
    SecuritySettingsRepository,
    SecurityChartsService,
    SecurityDashboardService,
    SecuritySettingsService,
  ],
  exports: [
    SecurityRepository,
    SecuritySettingsRepository,
    SecurityChartsService,
    SecurityDashboardService,
    SecuritySettingsService,
  ],
})
export class SecurityModule {}
