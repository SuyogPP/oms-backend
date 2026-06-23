import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ) { }

    canActivate(
        context: ExecutionContext,
    ): boolean {
        const requiredPermissions =
            this.reflector.getAllAndOverride<string[]>(
                PERMISSIONS_KEY,
                [
                    context.getHandler(),
                    context.getClass(),
                ],
            );

        // Route has no permissions
        if (
            !requiredPermissions ||
            requiredPermissions.length === 0
        ) {
            return true;
        }

        const request =
            context.switchToHttp().getRequest();

        const user = request.user;

        if (!user) {
            throw new ForbiddenException(
                'Unauthenticated.',
            );
        }

        const permissions: string[] =
            user.permissions ?? [];

        // SECURITY.ADMIN bypass
        if (
            permissions.includes('SECURITY.ADMIN')
        ) {
            return true;
        }

        const allowed =
            requiredPermissions.every((permission) =>
                permissions.includes(permission),
            );

        if (!allowed) {
            throw new ForbiddenException(
                'Insufficient permissions.',
            );
        }

        return true;
    }
}