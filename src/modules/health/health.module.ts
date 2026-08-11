import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * HealthModule encapsulates health-check features.
 * Exposes the HealthController to handle readiness and liveness probes.
 */
@Module({
    controllers: [HealthController],
})
export class HealthModule {}