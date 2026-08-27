import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { DelegationsService } from '../services/delegations.service';
import {
  CreateDelegationDto,
  UpdateDelegationDto,
} from '../dto/create-delegation.dto';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { USER_PERMISSIONS } from '../../users/users.constants';

@ApiTags('Authorization - Delegations')
@ApiBearerAuth('JWT')
@Controller('authorization')
export class DelegationsController {
  constructor(private readonly delegationsService: DelegationsService) {}

  @Get('me/delegations')
  @ApiOperation({
    summary:
      'Get active delegations granted by and received by the current authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lists of granted and received delegations',
  })
  async getMyDelegations(@CurrentUser() currentUser?: ICurrentUser) {
    return this.delegationsService.findMyDelegations(currentUser?.userId || '');
  }

  @Get('users/:id/delegations')
  @RequirePermissions(USER_PERMISSIONS.VIEW)
  @UseGuards(PermissionGuard)
  @ApiOperation({
    summary: 'Get all delegations granted by a target user (scope-enforced)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of delegations retrieved',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findByUserId(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.delegationsService.findByUserId(id, currentUser?.userId);
  }

  @Post('users/:id/delegations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a delegation of authority (Enforces Rules D1-D7; self-management or USER.DELEGATION.MANAGE)',
  })
  @ApiParam({ name: 'id', description: 'Delegator User UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Delegation created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation failure: D1 self-delegation, D2 invalid dates (>90 days), D4 invalid delegate (non-internal/inactive), D5 chained delegation, or missing reason',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'D3 Overlapping active delegation exists',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Managing another user delegation without USER.DELEGATION.MANAGE permission',
  })
  async create(
    @Param('id') id: string,
    @Body() dto: CreateDelegationDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.delegationsService.create(id, dto, currentUser?.userId);
  }

  @Patch('delegations/:id')
  @ApiOperation({
    summary:
      'Update an existing delegation (self-management or USER.DELEGATION.MANAGE)',
  })
  @ApiParam({ name: 'id', description: 'Delegation UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Delegation updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid dates or duration > 90 days',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Delegation not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Modifying another user delegation without USER.DELEGATION.MANAGE',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDelegationDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.delegationsService.update(id, dto, currentUser?.userId);
  }

  @Delete('delegations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cancel/end an active delegation (self-management or USER.DELEGATION.MANAGE)',
  })
  @ApiParam({ name: 'id', description: 'Delegation UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Delegation cancelled successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Delegation not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Cancelling another user delegation without USER.DELEGATION.MANAGE',
  })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    await this.delegationsService.cancel(id, currentUser?.userId);
    return {
      success: true,
      message: 'Delegation cancelled successfully.',
    };
  }
}
