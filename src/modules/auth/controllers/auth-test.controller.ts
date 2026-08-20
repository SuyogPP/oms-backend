import {
    Controller,
    Get,
    Query,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
import {
    BaseQueryDto,
    PaginatedResult,
} from '../../../common/dto/pagination.dto';
import { RateLimit } from '../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../common/rate-limit/rate-limit.constants';
import { FilterOperator } from '../../../common/dto/filtering.dto';

/**
 * AuthTestController provides a set of endpoints to test various authentication
 * and authorization guards (Public, Roles, Permissions, Scopes) as well as
 * Step 0 cross-cutting infrastructure (Pagination, Filtering, Envelopes, Rate limits).
 */
@ApiTags('Authentication & Step 0 Test')
@ApiBearerAuth('JWT')
@Controller('auth-test')
export class AuthTestController {
    constructor(private readonly authorizationService: AuthorizationService) {}

    /**
     * Public endpoint that bypasses all guards.
     */
    @Get('public')
    @Public()
    @ApiOperation({ summary: 'Public test route' })
    getPublicRoute() {
        return { message: 'This is a public route, no token needed!' };
    }

    /**
     * Gate verification endpoint: tests standard envelope, pagination, sorting,
     * structured filtering, rate limiting (Tier 5 - Search: 30 req/min), and audit tracking.
     */
    @Get('gate')
    @Public()
    @RateLimit(RateLimitTier.TIER_5_SEARCH)
    @ApiOperation({
        summary:
            'Step 0 Gate verification endpoint (paginated, filtered, rate-limited, enveloped)',
    })
    getGateVerification(@Query() query: BaseQueryDto) {
        const mockData = Array.from({ length: 54 }, (_, i) => ({
            id: `item-${i + 1}`,
            name: `Test Resource ${i + 1}`,
            role: i % 2 === 0 ? 'ENGINEER' : 'CONSULTANT',
            department: i % 3 === 0 ? 'Information Technology' : 'Operations',
            createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        }));

        let filtered = mockData;

        // Apply free-text search
        if (query.search) {
            const s = query.search.toLowerCase();
            filtered = filtered.filter(
                (item) =>
                    item.name.toLowerCase().includes(s) ||
                    item.role.toLowerCase().includes(s) ||
                    item.department.toLowerCase().includes(s),
            );
        }

        // Apply structured column filters
        if (query.filters && query.filters.length > 0) {
            for (const f of query.filters) {
                const fieldName = f.field.toLowerCase();
                const op = f.operator || FilterOperator.EQ;
                const val = f.value;

                filtered = filtered.filter((item: any) => {
                    const itemVal = item[fieldName] || item[f.field];
                    if (itemVal === undefined) return true;

                    switch (op) {
                        case FilterOperator.EQ:
                            return String(itemVal).toLowerCase() === String(val).toLowerCase();
                        case FilterOperator.NE:
                            return String(itemVal).toLowerCase() !== String(val).toLowerCase();
                        case FilterOperator.CONTAINS:
                            return String(itemVal).toLowerCase().includes(String(val).toLowerCase());
                        case FilterOperator.IN:
                            return Array.isArray(val)
                                ? val.map((v) => String(v).toLowerCase()).includes(String(itemVal).toLowerCase())
                                : false;
                        default:
                            return true;
                    }
                });
            }
        }

        const offset = query.offset;
        const pageItems = filtered.slice(offset, offset + query.pageSize);

        return PaginatedResult.create(pageItems, filtered.length, query);
    }

    /**
     * Error simulation endpoint to test global exception filter & standard error envelope.
     */
    @Get('error-test')
    @Public()
    @ApiOperation({ summary: 'Test endpoint that triggers a validation error' })
    getErrorTest() {
        throw new BadRequestException(
            'This is a simulated validation error for Step 0 testing',
        );
    }

    /**
     * Protected endpoint that requires a valid JWT token.
     * @param user The current authenticated user
     */
    @Get('protected')
    @ApiOperation({ summary: 'Protected test route requiring JWT' })
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
    @ApiOperation({ summary: 'Role-protected test route' })
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
    @ApiOperation({ summary: 'Permission-protected test route' })
    getPermissionsRoute(@CurrentUser() user: ICurrentUser) {
        return {
            message: 'You have access because you have the USER.MANAGE permission.',
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
    @ApiOperation({ summary: 'Scope-protected test route' })
    getScopesRoute(@CurrentUser() user: ICurrentUser) {
        return {
            message: 'You have access because you have the internal scope.',
            user,
        };
    }
}
