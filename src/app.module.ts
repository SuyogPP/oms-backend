import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

// Configuration & Database
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';

// Common Infrastructure
import { CommonModule } from './common/common.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestMetadataInterceptor } from './common/interceptors/request-metadata.interceptor';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';

// Application Modules
import { SecurityEventsModule } from './modules/security-events/security-events.module';
import { AuditModule } from './modules/audit/audit.module';
import { SecurityModule } from './modules/security/security.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { RetentionModule } from './modules/retention/retention.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';

// Guards
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

/**
 * Root Application Module.
 * Aggregates core infrastructure, scheduler, security guards, filters, interceptors, and business modules.
 */
@Module({
  imports: [
    // Global environment config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),

    // Automated Scheduler for Cron Jobs
    ScheduleModule.forRoot(),

    // Common Infrastructure
    CommonModule,

    // Database connection
    DatabaseModule,

    // Security & Audit
    SecurityEventsModule,
    AuditModule,
    SecurityModule,

    // Domain Modules
    HealthModule,
    AuthModule,
    RetentionModule,
    OrganizationModule,
    AuthorizationModule,
  ],
  providers: [
    // 1. Rate Limiting Guard (Applies before JWT auth)
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    // 2. Global JWT Auth Guard (Public routes bypass via @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 3. Global Exception Filter (Unified Error Envelope)
    {
      provide: APP_FILTER,
      useClass: GlobalHttpExceptionFilter,
    },
    // 4. Request Metadata Interceptor (Response timing & headers)
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetadataInterceptor,
    },
    // 5. Global Response Envelope Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
