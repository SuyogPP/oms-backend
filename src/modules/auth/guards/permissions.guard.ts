import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthorizationService } from '../services/authorization.service';

@Injectable()
export class PermissionGuard implements CanActivate {

    constructor(
        private readonly reflector: Reflector,
        private readonly authorizationService: AuthorizationService,
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

        console.log(
            '🚀 Required Permissions:',
            requiredPermissions,
        );

        // No permission required
        if (
            !requiredPermissions ||
            requiredPermissions.length === 0
        ) {
            return true;
        }

        const request =
            context.switchToHttp().getRequest();

        const user = request.user;

        console.log(
            '🚀 Current User:',
            user,
        );

        if (!user) {
            throw new ForbiddenException(
                'Unauthenticated.',
            );
        }

        try {

            this.authorizationService.authorize(
                user,
                requiredPermissions,
            );

            return true;

        } catch (error) {

            console.error(
                'Authorization Failed:',
                error,
            );

            throw new ForbiddenException(
                error instanceof Error
                    ? error.message
                    : 'Insufficient permissions.',
            );

        }
    }
}