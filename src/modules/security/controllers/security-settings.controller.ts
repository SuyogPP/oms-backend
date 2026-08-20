import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { RateLimit } from '../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../common/rate-limit/rate-limit.constants';
import { RequestContextService } from '../../../common/services/request-context.service';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { PermissionGuard } from '../../auth/guards/permissions.guard';
import {
    RevokeSessionsResponseDto,
    SecuritySettingsResponseDto,
    UpdateSecuritySettingsDto,
    UserSessionDto,
} from '../dto/security-settings.dto';
import { SecuritySettingsService } from '../services/security-settings.service';

@ApiTags('Internal Security Settings & Admin Sessions')
@ApiBearerAuth('JWT')
@UseGuards(PermissionGuard)
@Controller('internal/security')
export class SecuritySettingsController {
    constructor(
        private readonly securitySettingsService: SecuritySettingsService,
        private readonly requestContextService: RequestContextService,
    ) {}

    @Get('settings')
    @RequirePermissions(PERMISSIONS.SECURITY_ADMIN)
    @RateLimit(RateLimitTier.TIER_3_DASHBOARD)
    @ApiOperation({ summary: 'Get all security configuration settings' })
    async getSettings(): Promise<SecuritySettingsResponseDto> {
        return this.securitySettingsService.getSettings();
    }

    @Put('settings')
    @RequirePermissions(PERMISSIONS.SECURITY_ADMIN)
    @RateLimit(RateLimitTier.TIER_4_CRUD)
    @ApiOperation({ summary: 'Update security configuration settings' })
    async updateSettings(
        @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: UpdateSecuritySettingsDto,
    ): Promise<RevokeSessionsResponseDto> {
        const userId = this.requestContextService.getUserId() || 'SYSTEM';
        const ipAddress = this.requestContextService.getIpAddress();
        const userAgent = this.requestContextService.getUserAgent();

        return this.securitySettingsService.updateSettings(dto, userId, ipAddress, userAgent);
    }

    @Get('settings/users/:userId/sessions')
    @RequirePermissions(PERMISSIONS.SECURITY_SESSIONS_VIEW)
    @RateLimit(RateLimitTier.TIER_3_DASHBOARD)
    @ApiOperation({ summary: 'Get all login sessions for a specific user' })
    async getUserSessions(@Param('userId') userId: string): Promise<UserSessionDto[]> {
        return this.securitySettingsService.getSessionsByUserId(userId);
    }

    @Delete('settings/users/:userId/sessions/:sessionId')
    @RequirePermissions(PERMISSIONS.SECURITY_SESSIONS_REVOKE)
    @RateLimit(RateLimitTier.TIER_2_SESSION)
    @ApiOperation({ summary: 'Admin termination of a specific user session' })
    async revokeUserSession(
        @Param('userId') userId: string,
        @Param('sessionId') sessionId: string,
    ): Promise<RevokeSessionsResponseDto> {
        const adminUserId = this.requestContextService.getUserId() || 'SYSTEM';
        const ipAddress = this.requestContextService.getIpAddress();
        const userAgent = this.requestContextService.getUserAgent();

        return this.securitySettingsService.revokeSession(sessionId, adminUserId, ipAddress, userAgent);
    }

    @Post('settings/users/:userId/logout-all')
    @RequirePermissions(PERMISSIONS.SECURITY_USERS_FORCE_LOGOUT)
    @RateLimit(RateLimitTier.TIER_2_SESSION)
    @ApiOperation({ summary: 'Admin force-logout all active sessions for a target user' })
    async forceLogoutUser(@Param('userId') userId: string): Promise<RevokeSessionsResponseDto> {
        const adminUserId = this.requestContextService.getUserId() || 'SYSTEM';
        const ipAddress = this.requestContextService.getIpAddress();
        const userAgent = this.requestContextService.getUserAgent();

        return this.securitySettingsService.revokeAllSessionsForUser(userId, adminUserId, ipAddress, userAgent);
    }

    @Post('sessions/revoke-all')
    @RequirePermissions(PERMISSIONS.SECURITY_ADMIN)
    @RateLimit(RateLimitTier.TIER_2_SESSION)
    @ApiOperation({ summary: 'Emergency system-wide revocation of all active sessions' })
    async revokeAllSessionsSystemWide(): Promise<RevokeSessionsResponseDto> {
        const adminUserId = this.requestContextService.getUserId() || 'SYSTEM';
        const ipAddress = this.requestContextService.getIpAddress();
        const userAgent = this.requestContextService.getUserAgent();

        return this.securitySettingsService.revokeAllSessionsSystemWide(adminUserId, ipAddress, userAgent);
    }
}
