import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../common/rate-limit/rate-limit.constants';
import { RequestContextService } from '../../../common/services/request-context.service';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { PermissionGuard } from '../../auth/guards/permissions.guard';
import { RetentionCleanupResultDto } from '../dto/retention.dto';
import { RetentionService } from '../services/retention.service';

@ApiTags('Retention & Cleanup Jobs')
@ApiBearerAuth('JWT')
@UseGuards(PermissionGuard)
@Controller('internal/jobs/retention')
export class RetentionController {
  constructor(
    private readonly retentionService: RetentionService,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.SECURITY_ADMIN)
  @RateLimit(RateLimitTier.TIER_4_CRUD)
  @ApiOperation({ summary: 'Manually trigger data retention cleanup job' })
  async executeCleanup(): Promise<RetentionCleanupResultDto> {
    const userId = this.requestContextService.getUserId() || 'ADMIN_USER';
    return this.retentionService.executeCleanup(`MANUAL_ADMIN_${userId}`);
  }
}
