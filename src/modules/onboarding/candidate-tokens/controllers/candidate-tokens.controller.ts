import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CandidateTokensService } from '../services/candidate-tokens.service';
import {
  IssueCandidateTokenDto,
  IssueCandidateTokenResponseDto,
  ValidateCandidateTokenDto,
  CandidateTokenValidationResponseDto,
  RevokeCandidateTokenDto,
} from '../dto/candidate-token.dto';
import { Public } from '../../../auth/decorators/public.decorator';
import { RateLimit } from '../../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../../common/rate-limit/rate-limit.constants';

@ApiTags('Onboarding - Candidate Access Tokens')
@Controller('onboarding/candidate-tokens')
export class CandidateTokensController {
  constructor(private readonly service: CandidateTokensService) {}

  @Post('issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a new 32-byte candidate access token (SHA-256 stored)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token issued successfully',
    type: IssueCandidateTokenResponseDto,
  })
  async issueToken(
    @Body() dto: IssueCandidateTokenDto,
  ): Promise<IssueCandidateTokenResponseDto> {
    return this.service.issueToken(dto.onboardingId, dto.expiryDays);
  }

  @Get('validate/:token')
  @Public()
  @RateLimit(RateLimitTier.TIER_1_AUTH_LOGIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate candidate token via URL param (Public, rate-limited)' })
  @ApiParam({ name: 'token', description: 'Raw base64url token string' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token is valid',
    type: CandidateTokenValidationResponseDto,
  })
  async validateTokenParam(
    @Param('token') token: string,
  ): Promise<CandidateTokenValidationResponseDto> {
    return this.service.validateToken(token);
  }

  @Post('validate')
  @Public()
  @RateLimit(RateLimitTier.TIER_1_AUTH_LOGIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate candidate token via POST body (Public, rate-limited)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token is valid',
    type: CandidateTokenValidationResponseDto,
  })
  async validateTokenBody(
    @Body() dto: ValidateCandidateTokenDto,
  ): Promise<CandidateTokenValidationResponseDto> {
    return this.service.validateToken(dto.token);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke outstanding tokens for an onboarding case' })
  async revokeTokens(
    @Body() dto: RevokeCandidateTokenDto,
  ): Promise<{ success: boolean; revokedCount: number }> {
    return this.service.revokeTokensForOnboarding(dto.onboardingId);
  }
}
