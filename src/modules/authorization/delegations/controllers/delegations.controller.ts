import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DelegationsService } from '../services/delegations.service';
import { CreateDelegationDto, UpdateDelegationDto } from '../dto/create-delegation.dto';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';

@ApiTags('Authorization - Delegations')
@ApiBearerAuth('JWT')
@Controller('authorization')
export class DelegationsController {
  constructor(private readonly delegationsService: DelegationsService) {}

  @Get('me/delegations')
  @ApiOperation({ summary: 'Get current user active received delegations' })
  async getMyDelegations(@CurrentUser() currentUser?: ICurrentUser) {
    return this.delegationsService.findMyDelegations(currentUser?.userId || '');
  }

  @Get('users/:id/delegations')
  @RequirePermissions('USER.VIEW')
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Get all delegations for a target user' })
  async findByUserId(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.delegationsService.findByUserId(id, currentUser?.userId);
  }

  @Post('users/:id/delegations')
  @ApiOperation({ summary: 'Create a delegation of authority from a user' })
  async create(
    @Param('id') id: string,
    @Body() dto: CreateDelegationDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.delegationsService.create(id, dto, currentUser?.userId);
  }

  @Patch('delegations/:id')
  @ApiOperation({ summary: 'Update an existing delegation' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDelegationDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.delegationsService.update(id, dto, currentUser?.userId);
  }

  @Delete('delegations/:id')
  @ApiOperation({ summary: 'Cancel/end an active delegation' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.delegationsService.cancel(id, currentUser?.userId);
  }
}
