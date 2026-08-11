import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Strategies and Guards
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionGuard } from './guards/permissions.guard';
import { ScopesGuard } from './guards/scopes.guard';

// Controllers
import { AuthTestController } from './controllers/auth-test.controller';
import { AuthorizationService } from './services/authorization.service';

/**
 * AuthModule configures Passport and JWT strategies for authentication and authorization.
 * It provides various guards (JWT, Roles, Permissions, Scopes) that can be applied across the application.
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
                    expiresIn: (configService.get<string>('jwt.expiresIn') || '15m') as any,
                    issuer: configService.get<string>('jwt.issuer'),
                    audience: configService.get<string>('jwt.audience'),
                },
            }),
        }),
    ],
    controllers: [AuthTestController],
    providers: [
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        PermissionGuard,
        ScopesGuard,
        AuthorizationService
    ],
    exports: [
        PassportModule,
        JwtModule,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        PermissionGuard,
        ScopesGuard,
        AuthorizationService
    ],
})
export class AuthModule { }
