import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { AuditInterceptor } from '../../../audit/interceptor/audit.interceptor';
import { InternalUserGuard } from '../../org-scope/guards/internal-user.guard';
import { ORG_PERMISSIONS } from '../../org-units/org-units.constants';
import { AssignManagerDto } from '../dto/assign-manager.dto';
import { UpdateManagerDto } from '../dto/update-manager.dto';
import { OrgManagerEntity } from '../entities/org-manager.entity';
import { OrgManagersService } from '../services/org-managers.service';

@ApiTags('Organization Managers')
@ApiBearerAuth()
@UseGuards(InternalUserGuard, PermissionGuard)
@UseInterceptors(AuditInterceptor)
@Controller('organization')
export class OrgManagersController {
  constructor(private readonly managersService: OrgManagersService) {}

  @Get('units/:id/managers')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get all manager assignment history for an organization unit',
  })
  @ApiResponse({
    status: 200,
    description: 'List of historical and current manager assignments',
    type: [OrgManagerEntity],
  })
  async findByUnitId(@Param('id') unitId: string) {
    return this.managersService.findByUnitId(unitId);
  }

  @Get('units/:id/managers/current')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get current active primary head manager for an organization unit',
  })
  @ApiResponse({
    status: 200,
    description: 'Current primary head manager details or null',
    type: OrgManagerEntity,
  })
  async findCurrentHead(
    @Param('id') unitId: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    return this.managersService.findCurrentHead(unitId, asOfDate);
  }

  @Get('users/:userId/managed-units')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get all organization units managed by a specific user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of organization units managed by the user',
    type: [OrgManagerEntity],
  })
  async findByUserId(@Param('userId') userId: string) {
    return this.managersService.findByUserId(userId);
  }

  @Post('units/:id/managers')
  @RequirePermissions(ORG_PERMISSIONS.MANAGER_ASSIGN)
  @ApiOperation({
    summary:
      'Assign a manager (HOD, Section Head, Deputy, Acting) to an org unit',
  })
  @ApiResponse({
    status: 201,
    description: 'The created manager assignment record',
    type: OrgManagerEntity,
  })
  async assignManager(
    @Param('id') unitId: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.managersService.assignManager(unitId, dto, user.userId);
  }

  @Patch('managers/:managerId')
  @RequirePermissions(ORG_PERMISSIONS.MANAGER_ASSIGN)
  @ApiOperation({ summary: 'Update manager assignment details or end date' })
  @ApiResponse({
    status: 200,
    description: 'Updated manager assignment record',
    type: OrgManagerEntity,
  })
  async updateManager(
    @Param('managerId') managerId: string,
    @Body() dto: UpdateManagerDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.managersService.updateManager(managerId, dto, user.userId);
  }

  @Delete('managers/:managerId')
  @RequirePermissions(ORG_PERMISSIONS.MANAGER_ASSIGN)
  @ApiOperation({ summary: 'Remove / end manager assignment' })
  @ApiResponse({
    status: 200,
    description: 'Manager assignment removed successfully',
  })
  async removeManager(
    @Param('managerId') managerId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    await this.managersService.removeManager(managerId, user.userId);
    return {
      success: true,
      message: 'Manager assignment removed successfully.',
    };
  }
}
