import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { AuditIgnore } from '../audit/decorators/audit-ignore.decorator';
import { SkipRateLimit } from '../../common/rate-limit/rate-limit.decorator';

/**
 * HealthController provides endpoints to verify the status of the API.
 * These endpoints are typically used by load balancers or monitoring tools.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  /**
   * Retrieves the health status of the application.
   * This endpoint is public and does not require JWT authentication.
   * @returns Status object indicating the API is running
   */
  @Public()
  @AuditIgnore()
  @SkipRateLimit()
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return {
      status: 'ok',
      service: 'oms-backend',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
