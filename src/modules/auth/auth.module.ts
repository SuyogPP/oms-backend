import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Strategies and Guards
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionGuard } from './guards/permissions.guard';
import { ScopesGuard } from './guards/scopes.guard';

// Controllers and Services
import { AuthTestController } from './controllers/auth-test.controller';
import { UserSessionsController } from './controllers/user-sessions.controller';
import { AuthCoreController } from './controllers/auth-core.controller';
import { AuthorizationService } from './services/authorization.service';
import { UserSessionsService } from './services/user-sessions.service';
import { AuthCoreService } from './services/auth-core.service';
import { UserSessionsRepository } from './repositories/user-sessions.repository';
import { AuthCoreRepository } from './repositories/auth-core.repository';
import { SecurityEventsModule } from '../security-events/security-events.module';
import { SecurityModule } from '../security/security.module';

/**
 * AuthModule configures Passport, JWT strategies, user authentication, and session management.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: (configService.get<string>('jwt.expiresIn') ||
            '15m') as any,
          issuer: configService.get<string>('jwt.issuer'),
          audience: configService.get<string>('jwt.audience'),
        },
      }),
    }),
    SecurityEventsModule,
    forwardRef(() => SecurityModule),
  ],
  controllers: [AuthTestController, UserSessionsController, AuthCoreController],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    PermissionGuard,
    ScopesGuard,
    AuthorizationService,
    UserSessionsService,
    UserSessionsRepository,
    AuthCoreService,
    AuthCoreRepository,
  ],
  exports: [
    PassportModule,
    JwtModule,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    PermissionGuard,
    ScopesGuard,
    AuthorizationService,
    UserSessionsService,
    UserSessionsRepository,
    AuthCoreService,
    AuthCoreRepository,
  ],
})
export class AuthModule {}
