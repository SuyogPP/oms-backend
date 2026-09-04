import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../common/rate-limit/rate-limit.constants';
import { RequestContextService } from '../../../common/services/request-context.service';
import { Public } from '../decorators/public.decorator';
import {
  LoginDto,
  LoginResponseDto,
  LogoutResponseDto,
  RefreshResponseDto,
  RefreshTokenDto,
} from '../dto/auth-core.dto';
import { AuthCoreService } from '../services/auth-core.service';

@ApiTags('Authentication Core')
@Controller('auth')
export class AuthCoreController {
  constructor(
    private readonly authCoreService: AuthCoreService,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitTier.TIER_1_AUTH_LOGIN)
  @ApiOperation({
    summary: 'Authenticate user credentials and issue token pair',
  })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    const ipAddress = this.requestContextService.getIpAddress();
    const userAgent = this.requestContextService.getUserAgent();

    return this.authCoreService.login(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit(RateLimitTier.TIER_1_AUTH_REFRESH)
  @ApiOperation({
    summary:
      'Rotate refresh token and issue new access token with replay detection',
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<RefreshResponseDto> {
    const ipAddress = this.requestContextService.getIpAddress();
    const userAgent = this.requestContextService.getUserAgent();

    return this.authCoreService.refresh(dto, ipAddress, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @RateLimit(RateLimitTier.TIER_2_SESSION)
  @ApiOperation({ summary: 'Revoke active session and refresh token' })
  async logout(): Promise<LogoutResponseDto> {
    const userId = this.requestContextService.getUserId();
    const loginSessionId = this.requestContextService.getLoginSessionId();
    const ipAddress = this.requestContextService.getIpAddress();
    const userAgent = this.requestContextService.getUserAgent();

    if (!userId || !loginSessionId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.authCoreService.logout(
      loginSessionId,
      userId,
      ipAddress,
      userAgent,
    );
  }
}
