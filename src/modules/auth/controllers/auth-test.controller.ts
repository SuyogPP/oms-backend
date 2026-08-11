import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../decorators/current-user.decorator';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { Scopes } from '../decorators/scopes.decorator';
import type { CurrentUser as ICurrentUser } from '../interfaces/current-user.interface';

import { PERMISSIONS } from 'src/common/constants/permissions';
import { PermissionGuard } from '../guards/permissions.guard';
import { RolesGuard } from '../guards/roles.guard';
import { ScopesGuard } from '../guards/scopes.guard';
import { AuthorizationService } from '../services/authorization.service';

/**
 * AuthTestController provides a set of endpoints to test various authentication
 * and authorization guards (Public, Roles, Permissions, Scopes).
 */
@ApiTags('Authentication Test')
@ApiBearerAuth('JWT')
@Controller('auth-test')
export class AuthTestController {

    constructor(

        private readonly authorizationService: AuthorizationService,

    ) { }

    /**
     * Public endpoint that bypasses all guards.
     */
    @Get('public')
    @Public()
    getPublicRoute() {
        return { message: 'This is a public route, no token needed!' };
    }

    /**
     * Protected endpoint that requires a valid JWT token.
     * @param user The current authenticated user
     */
    @Get('protected')
    getProtectedRoute(@CurrentUser() user: ICurrentUser) {
        return {
            message: 'This is a protected route, token is valid!',
            user,
        };
    }

    /**
     * Role-protected endpoint. Requires the user to have 'Admin' or 'Manager' roles.
     * @param user The current authenticated user
     */
    @Get('roles')
    @Roles('Admin', 'Manager')
    @UseGuards(RolesGuard)
    getRolesRoute(@CurrentUser() user: ICurrentUser) {
        return {
            message: 'You have access because you are an Admin or Manager.',
            user,
        };
    }

    /**
     * Permission-protected endpoint. Requires the user to have 'USER_MANAGE' permission.
     * @param user The current authenticated user
     */
    @Get('permissions')
    @RequirePermissions(PERMISSIONS.USER_MANAGE)
    @UseGuards(PermissionGuard)
    getPermissionsRoute(@CurrentUser() user: ICurrentUser) {
        return {
            message: 'You have access because you have the USER.READ permission.',
            user,
        };
    }

    /**
     * Scope-protected endpoint. Requires the user to have the 'internal' scope.
     * @param user The current authenticated user
     */
    @Get('scopes')
    @Scopes('internal')
    @UseGuards(ScopesGuard)
    getScopesRoute(@CurrentUser() user: ICurrentUser) {
        return {
            message: 'You have access because you have the internal scope.',
            user,
        };
    }
}
