import {
    Controller,
    Delete,
    Get,
    Param,
    Post,
    UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../common/rate-limit/rate-limit.constants';
import { RequestContextService } from '../../../common/services/request-context.service';
import {
    SessionActionResponseDto,
    UserSessionsListResponseDto,
} from '../dto/user-sessions.dto';
import { UserSessionsService } from '../services/user-sessions.service';

@ApiTags('Auth Sessions')
@ApiBearerAuth('JWT')
@Controller('auth/sessions')
export class UserSessionsController {
    constructor(
        private readonly userSessionsService: UserSessionsService,
        private readonly requestContextService: RequestContextService,
    ) {}

    @Get()
    @RateLimit(RateLimitTier.TIER_2_SESSION)
    @ApiOperation({ summary: 'Get all active sessions for the current authenticated user' })
    async getSessions(): Promise<UserSessionsListResponseDto> {
        const userId = this.requestContextService.getUserId();
        const currentSessionId = this.requestContextService.getLoginSessionId();

        if (!userId) {
            throw new UnauthorizedException('User not authenticated');
        }

        return this.userSessionsService.getUserSessions(userId, currentSessionId);
    }

    @Delete(':id')
    @RateLimit(RateLimitTier.TIER_2_SESSION)
    @ApiOperation({ summary: 'Terminate a specific active session' })
    async revokeSession(@Param('id') id: string): Promise<SessionActionResponseDto> {
        const userId = this.requestContextService.getUserId();
        const currentSessionId = this.requestContextService.getLoginSessionId();
        const ipAddress = this.requestContextService.getIpAddress();
        const userAgent = this.requestContextService.getUserAgent();

        if (!userId) {
            throw new UnauthorizedException('User not authenticated');
        }

        return this.userSessionsService.revokeSession(
            id,
            userId,
            currentSessionId,
            ipAddress,
            userAgent,
        );
    }

    @Post('revoke-all')
    @RateLimit(RateLimitTier.TIER_2_SESSION)
    @ApiOperation({ summary: 'Terminate all active sessions except current session' })
    async revokeAllOtherSessions(): Promise<SessionActionResponseDto> {
        const userId = this.requestContextService.getUserId();
        const currentSessionId = this.requestContextService.getLoginSessionId();
        const ipAddress = this.requestContextService.getIpAddress();
        const userAgent = this.requestContextService.getUserAgent();

        if (!userId) {
            throw new UnauthorizedException('User not authenticated');
        }

        return this.userSessionsService.revokeAllOtherSessions(
            userId,
            currentSessionId,
            ipAddress,
            userAgent,
        );
    }
}
