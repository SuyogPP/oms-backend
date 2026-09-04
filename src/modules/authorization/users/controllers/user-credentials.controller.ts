import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UserCredentialsService } from '../services/user-credentials.service';
import {
  AcceptInvitationDto,
  InviteUserDto,
  ValidateInvitationResponseDto,
  GenericSuccessResponseDto,
  InvitationDispatchResultDto,
} from '../dto/user-credentials.dto';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { Public } from '../../../auth/decorators/public.decorator';
import { RateLimit } from '../../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../../common/rate-limit/rate-limit.constants';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { USER_PERMISSIONS } from '../users.constants';

@ApiTags('Authorization - User Credentials & Invitations')
@Controller('authorization')
export class UserCredentialsController {
  constructor(
    private readonly userCredentialsService: UserCredentialsService,
  ) {}

  // ===========================================================================
  // ADMINISTRATIVE CREDENTIALS ENDPOINTS (PROTECTED BY PERMISSIONS)
  // ===========================================================================

  @Post('users/:id/invite')
  @ApiBearerAuth('JWT')
  @RequirePermissions(USER_PERMISSIONS.INVITE)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send or re-issue onboarding invitation email with secure token',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation token generated and email dispatched',
    type: InvitationDispatchResultDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Missing USER.INVITE permission',
  })
  async inviteUser(
    @Param('id') id: string,
    @Body() dto?: InviteUserDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ): Promise<InvitationDispatchResultDto> {
    return this.userCredentialsService.inviteUser(
      id,
      dto?.resend || false,
      currentUser?.userId,
    );
  }

  @Post('users/:id/reset-password')
  @ApiBearerAuth('JWT')
  @RequirePermissions(USER_PERMISSIONS.PASSWORD_RESET)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Initiate password reset (Admins never set/see passwords; issues 1-hour reset token and revokes sessions)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Password reset token generated and dispatched; sessions terminated',
    type: InvitationDispatchResultDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Missing USER.PASSWORD.RESET permission',
  })
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ): Promise<InvitationDispatchResultDto> {
    return this.userCredentialsService.resetPassword(id, currentUser?.userId);
  }

  @Post('users/:id/unlock')
  @ApiBearerAuth('JWT')
  @RequirePermissions(USER_PERMISSIONS.UNLOCK)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear failed login attempts and unlock user account',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User account unlocked successfully',
    type: GenericSuccessResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Missing USER.UNLOCK permission',
  })
  async unlockUser(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ): Promise<GenericSuccessResponseDto> {
    return this.userCredentialsService.unlockUser(id, currentUser?.userId);
  }

  // ===========================================================================
  // PUBLIC INVITATION ENDPOINTS (RATE LIMITED TIER 1, UNENCRYPTED/ANONYMOUS)
  // ===========================================================================

  @Post('invitations/:token/validate')
  @Public()
  @RateLimit(RateLimitTier.TIER_1_AUTH_LOGIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Public endpoint: Validate onboarding or reset token without consuming it',
  })
  @ApiParam({ name: 'token', description: 'Raw invitation token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token is valid and active',
    type: ValidateInvitationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Invalid, expired, revoked, or non-existent token (generic error message)',
  })
  async validateInvitation(
    @Param('token') token: string,
  ): Promise<ValidateInvitationResponseDto> {
    return this.userCredentialsService.validateInvitationToken(token);
  }

  @Post('invitations/:token/accept')
  @Public()
  @RateLimit(RateLimitTier.TIER_1_AUTH_LOGIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Public endpoint: Set password and activate account using invitation or reset token',
  })
  @ApiParam({ name: 'token', description: 'Raw invitation token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password configured and account activated',
    type: GenericSuccessResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid token or password history/complexity violation',
  })
  async acceptInvitation(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ): Promise<GenericSuccessResponseDto> {
    return this.userCredentialsService.acceptInvitation(token, dto);
  }
}
