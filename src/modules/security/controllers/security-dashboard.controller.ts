import {
  Controller,
  Get,
  Query,
  Sse,
  UseGuards,
  MessageEvent,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  BaseQueryDto,
  PaginatedResult,
} from '../../../common/dto/pagination.dto';
import { RateLimit } from '../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../common/rate-limit/rate-limit.constants';
import { BypassTransform } from '../../../common/decorators/bypass-transform.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { PermissionGuard } from '../../auth/guards/permissions.guard';
import type { CurrentUser as ICurrentUser } from '../../auth/interfaces/current-user.interface';
import {
  FailedLoginAttemptDto,
  SecurityDashboardDataDto,
  SecurityDashboardSummaryDto,
  SecurityEventDto,
  SecuritySummaryDto,
} from '../dto/security-dashboard.dto';
import { SecurityDashboardService } from '../services/security-dashboard.service';

@ApiTags('Internal Security Dashboard')
@ApiBearerAuth('JWT')
@RateLimit(RateLimitTier.TIER_3_DASHBOARD)
@UseGuards(PermissionGuard)
@Controller('internal/security')
export class SecurityDashboardController {
  constructor(
    private readonly securityDashboardService: SecurityDashboardService,
  ) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Get composite security dashboard data' })
  async getDashboard(): Promise<SecurityDashboardDataDto> {
    return this.securityDashboardService.getDashboardData();
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
  @ApiOperation({ summary: 'Get 24-hour security summary metrics' })
  async getSummary(): Promise<SecurityDashboardSummaryDto> {
    return this.securityDashboardService.getSummary();
  }

  @Get('user-summary')
  @ApiOperation({
    summary: "Get current authenticated user's 30-day security summary",
  })
  async getUserSummary(
    @CurrentUser() user: ICurrentUser,
  ): Promise<SecuritySummaryDto> {
    if (!user?.userId) {
      throw new UnauthorizedException(
        'User identity not found in request context',
      );
    }
    return this.securityDashboardService.getUserSummary(user.userId);
  }

  @Get('events')
  @RequirePermissions(PERMISSIONS.SECURITY_EVENTS_VIEW)
  @ApiOperation({
    summary: 'Get paginated, filtered, and sorted security events',
  })
  async getEvents(
    @Query() query: BaseQueryDto,
  ): Promise<PaginatedResult<SecurityEventDto>> {
    return this.securityDashboardService.getSecurityEvents(query);
  }

  @Get('failed-logins')
  @RequirePermissions(PERMISSIONS.SECURITY_FAILED_LOGINS_VIEW)
  @ApiOperation({
    summary: 'Get paginated, filtered, and sorted failed login attempts',
  })
  async getFailedLogins(
    @Query() query: BaseQueryDto,
  ): Promise<PaginatedResult<FailedLoginAttemptDto>> {
    return this.securityDashboardService.getFailedLogins(query);
  }

  @Sse('stream')
  @BypassTransform()
  @RequirePermissions(PERMISSIONS.SECURITY_DASHBOARD_VIEW)
  @ApiOperation({
    summary:
      'Server-Sent Events (SSE) stream for real-time security dashboard updates',
  })
  getSecurityStream(): Observable<MessageEvent> {
    return this.securityDashboardService.getEventStream();
  }
}
