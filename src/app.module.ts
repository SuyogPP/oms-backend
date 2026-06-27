import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

// Configuration & Database
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';

// Application Modules
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

// Guards
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

/**
 * The root module of the application.
 * This module aggregates all other modules, configurations, and global providers
 * required to bootstrap the NestJS application.
 */
@Module({
  imports: [
    // Initializes the ConfigModule globally so that environment variables
    // can be accessed anywhere in the application.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),

    // Establishes the connection to the database.
    DatabaseModule,

    // Core business modules
    HealthModule, // Handles health checks and monitoring
    UsersModule,  // Manages user-related operations (CRUD, profiles)
    AuthModule,   // Handles authentication and authorization
  ],
  providers: [
    // Applies the JwtAuthGuard globally.
    // This ensures all endpoints require a valid JWT token by default unless explicitly decorated with @Public().
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}