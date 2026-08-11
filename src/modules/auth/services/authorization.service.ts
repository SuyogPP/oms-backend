import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { AuthorizationContext } from '../interfaces/authorization-context.interface';

@Injectable()
export class AuthorizationService {
    private readonly logger = new Logger(AuthorizationService.name);

    /**
     * Checks if the context has a specific permission.
     */
    hasPermission(context: AuthorizationContext, permission: string): boolean {
        return !!context?.permissions?.includes(permission);
    }

    /**
     * Checks if the context has all specified permissions.
     */
    hasPermissions(context: AuthorizationContext, permissions: string[]): boolean {
        if (!context?.permissions || !permissions?.length) {
            return false;
        }
        return permissions.every((p) => context.permissions.includes(p));
    }

    /**
     * Checks if the context has a specific role.
     */
    hasRole(context: AuthorizationContext, role: string): boolean {
        return !!context?.roles?.includes(role);
    }

    /**
     * Checks if the context has a specific scope.
     */
    hasScope(context: AuthorizationContext, scope: string): boolean {
        return !!context?.scopes?.includes(scope);
    }

    /**
     * Authorizes the context against required permissions.
     * Throws ForbiddenException if authorization fails.
     */
    authorize(context: AuthorizationContext, requiredPermissions: string[]): void {
        if (!context?.permissions) {
            this.logger.warn('Authorization failed: Context or permissions are missing.');
            throw new ForbiddenException('Insufficient permissions');
        }

        if (context.permissions.includes('SECURITY.ADMIN')) {
            return;
        }

        if (!requiredPermissions?.length) {
            return;
        }

        const isAllowed = requiredPermissions.every((permission) =>
            context.permissions.includes(permission),
        );

        if (!isAllowed) {
            throw new ForbiddenException('Insufficient permissions');
        }
    }
}