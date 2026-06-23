import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../interfaces/current-user.interface';
import { Roles } from '../decorators/roles.decorator';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { Scopes } from '../decorators/scopes.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { PermissionGuard } from '../guards/permissions.guard';
import { ScopesGuard } from '../guards/scopes.guard';

@ApiTags('Authentication Test')
@ApiBearerAuth('JWT')
@Controller('auth-test')
export class AuthTestController {



    @Get('public')
    @Public()
    getPublicRoute() {
        return { message: 'This is a public route, no token needed!' };
    }



    @Get('protected')
    getProtectedRoute(@CurrentUser() user: ICurrentUser) {
        return {
            message: 'This is a protected route, token is valid!',
            user
        };
    }

    @Get('roles')
    @Roles('Admin', 'Manager')
    @UseGuards(RolesGuard)
    getRolesRoute(@CurrentUser() user: ICurrentUser) {
        return {
            message: 'You have access because you are an Admin or Manager.',
            user
        };
    }

    @Get('permissions')
    @RequirePermissions('USER:READ')
    @UseGuards(PermissionGuard)
    getPermissionsRoute(@CurrentUser() user: ICurrentUser) {
        return {
            message: 'You have access because you have the USER.READ permission.',
            user
        };
    }

    @Get('scopes')
    @Scopes('internal')
    @UseGuards(ScopesGuard)
    getScopesRoute(@CurrentUser() user: ICurrentUser) {
        return {
            message: 'You have access because you have the internal scope.',
            user
        };
    }
}
