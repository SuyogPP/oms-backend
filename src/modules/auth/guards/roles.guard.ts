import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../constants/auth.constants';
import { CurrentUser } from '../interfaces/current-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user as CurrentUser;

        if (!user || !user.roles) {
            throw new ForbiddenException('You do not have the required roles to access this resource.');
        }

        const hasRole = requiredRoles.some((role) => user.roles.includes(role));
        if (!hasRole) {
            throw new ForbiddenException('You do not have the required roles to access this resource.');
        }

        return true;
    }
}
