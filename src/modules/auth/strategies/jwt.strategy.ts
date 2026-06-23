import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CurrentUser } from '../interfaces/current-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.secret')!,
            issuer: configService.get<string>('jwt.issuer'),
            audience: configService.get<string>('jwt.audience'),
            passReqToCallback: true,
        });
    }

    async validate(req: any, payload: any): Promise<CurrentUser> {
        const userId = req.headers['x-user-id'] || payload.userId || payload.userid;
        if (!payload || !userId) {
            throw new UnauthorizedException('Invalid token payload: missing userId');
        }

        const parseHeader = (headerName: string) => {
            const val = req.headers[headerName];
            if (!val) return [];
            try {
                return JSON.parse(val as string);
            } catch {
                return [];
            }
        };

        const roles = parseHeader('x-roles');
        const permissions = parseHeader('x-permissions');
        const scopes = parseHeader('x-scopes');

        // Fallback to payload for direct requests (e.g. Swagger bypassing the proxy)
        if (roles.length === 0) {
            if (payload.roles) roles.push(...payload.roles);
            const dotNetRole = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
            if (dotNetRole) {
                if (Array.isArray(dotNetRole)) roles.push(...dotNetRole);
                else roles.push(dotNetRole);
            }
        }

        const user: CurrentUser = {
            userId: userId,
            email: req.headers['x-email'] || payload.email || '',
            userType: req.headers['x-user-type'] || payload.userType || 'User',
            roles: roles,
            permissions: permissions.length > 0 ? permissions : (payload.permissions || []),
            scopes: scopes.length > 0 ? scopes : (payload.scopes || []),
            loginSessionId: req.headers['x-login-session-id'] || payload.loginSessionId,
        };

        return user;
    }
}
