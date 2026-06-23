import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionGuard } from './guards/permissions.guard';
import { ScopesGuard } from './guards/scopes.guard';
import { AuthTestController } from './controllers/auth-test.controller';

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
    ],
    exports: [
        PassportModule,
        JwtModule,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        PermissionGuard,
        ScopesGuard,
    ],
})
export class AuthModule { }
