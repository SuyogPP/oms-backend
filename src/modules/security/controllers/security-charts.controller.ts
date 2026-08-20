import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { RateLimit } from '../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../common/rate-limit/rate-limit.constants';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { PermissionGuard } from '../../auth/guards/permissions.guard';
import {
    FailedLoginsChartDto,
    LockedAccountsDto,
    LoginTrendDto,
    ReplayEventsDto,
    SecurityEventsByTypeDto,
    SessionsByDeviceDto,
    SessionsByRoleDto,
    SessionsCreatedPerDayDto,
} from '../dto/security-dashboard.dto';
import { SecurityChartsService } from '../services/security-charts.service';

@ApiTags('Internal Security Charts')
@ApiBearerAuth('JWT')
@RateLimit(RateLimitTier.TIER_3_DASHBOARD)
@UseGuards(PermissionGuard)
@Controller('internal/security/charts')
export class SecurityChartsController {
    constructor(private readonly securityChartsService: SecurityChartsService) {}

    @Get('sessions-by-device')
    @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
    @ApiOperation({ summary: 'Active sessions aggregated by device/browser' })
    async getSessionsByDevice(): Promise<SessionsByDeviceDto[]> {
        return this.securityChartsService.getSessionsByDevice();
    }

    @Get('sessions-by-role')
    @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
    @ApiOperation({ summary: 'Active sessions aggregated by user role' })
    async getSessionsByRole(): Promise<SessionsByRoleDto[]> {
        return this.securityChartsService.getSessionsByRole();
    }

    @Get('login-trend')
    @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
    @ApiOperation({ summary: 'Daily login success and failure trend' })
    async getLoginTrend(): Promise<LoginTrendDto[]> {
        return this.securityChartsService.getLoginTrend();
    }

    @Get('security-events-by-type')
    @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
    @ApiOperation({ summary: 'Security events count grouped by event type' })
    async getSecurityEventsByType(): Promise<SecurityEventsByTypeDto[]> {
        return this.securityChartsService.getSecurityEventsByType();
    }

    @Get('locked-accounts')
    @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
    @ApiOperation({ summary: 'Currently locked user accounts and lockout counts' })
    async getLockedAccounts(): Promise<LockedAccountsDto[]> {
        return this.securityChartsService.getLockedAccounts();
    }

    @Get('failed-logins')
    @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
    @ApiOperation({ summary: 'Daily count of failed login attempts (last 30 days)' })
    async getFailedLogins(): Promise<FailedLoginsChartDto[]> {
        return this.securityChartsService.getFailedLogins();
    }

    @Get('replay-events')
    @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
    @ApiOperation({ summary: 'Daily count of refresh token replay events' })
    async getReplayEvents(): Promise<ReplayEventsDto[]> {
        return this.securityChartsService.getReplayEvents();
    }

    @Get('sessions-created-per-day')
    @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
    @ApiOperation({ summary: 'Daily count of created login sessions' })
    async getSessionsCreatedPerDay(): Promise<SessionsCreatedPerDayDto[]> {
        return this.securityChartsService.getSessionsCreatedPerDay();
    }
}
