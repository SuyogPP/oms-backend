import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { AuditInterceptor } from '../../../audit/interceptor/audit.interceptor';
import { RateLimit } from '../../../../common/rate-limit/rate-limit.decorator';
import { RateLimitTier } from '../../../../common/rate-limit/rate-limit.constants';
import { InternalUserGuard } from '../../org-scope/guards/internal-user.guard';
import { CreateOrgUnitDto } from '../dto/create-org-unit.dto';
import { ListOrgUnitsDto } from '../dto/list-org-units.dto';
import { MoveOrgUnitDto } from '../dto/move-org-unit.dto';
import { UpdateOrgUnitDto } from '../dto/update-org-unit.dto';
import {
  OrgUnitDetailEntity,
  OrgUnitEntity,
  OrgUnitTreeItemEntity,
} from '../entities/org-unit.entity';
import { ORG_PERMISSIONS } from '../org-units.constants';
import { OrgUnitsService } from '../services/org-units.service';

@ApiTags('Organization Units')
@ApiBearerAuth()
@UseGuards(InternalUserGuard, PermissionGuard)
@UseInterceptors(AuditInterceptor)
@Controller('organization')
export class OrgUnitsController {
  constructor(private readonly orgUnitsService: OrgUnitsService) {}

  @Get('units')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Get paginated, scope-filtered organization units' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of visible organization units',
    type: [OrgUnitEntity],
  })
  async findAll(
    @Query() query: ListOrgUnitsDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.orgUnitsService.findAll(query, user.userId);
  }

  @Get('units/tree')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get full visible organization hierarchy as a nested tree',
  })
  @ApiResponse({
    status: 200,
    description: 'Nested N-ary organization tree',
    type: [OrgUnitTreeItemEntity],
  })
  async findTree(@CurrentUser() user: ICurrentUser) {
    return this.orgUnitsService.findTree(user.userId);
  }

  @Get('me/visible-units')
  @ApiOperation({
    summary: 'Get all organization units visible to the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of visible organization units for user scope',
  })
  async getMyVisibleUnits(@CurrentUser() user: ICurrentUser) {
    return this.orgUnitsService.getMyVisibleUnits(user.userId);
  }

  @Get('units/export')
  @RequirePermissions(ORG_PERMISSIONS.EXPORT)
  @RateLimit(RateLimitTier.TIER_7_REPORTS)
  @ApiOperation({
    summary:
      'Export scope-filtered organization units to Excel (Rate Limit Tier 7: 5 req/min)',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file (.xlsx) downloaded successfully',
  })
  @ApiResponse({
    status: 202,
    description: 'Export job queued for background generation (> 5,000 rows)',
  })
  async exportToExcel(
    @Query() query: ListOrgUnitsDto,
    @CurrentUser() user: ICurrentUser,
    @Res() res: Response,
  ) {
    const result = await this.orgUnitsService.exportToExcel(query, user.userId);

    if (result.queued) {
      return res.status(202).json({
        success: true,
        data: {
          queued: true,
          jobId: result.jobId,
          totalRows: result.totalRows,
          message: result.message,
        },
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    return res.send(result.buffer);
  }

  @Get('units/:id')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get organization unit details with breadcrumb path',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization unit detailed entity',
    type: OrgUnitDetailEntity,
  })
  async findById(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.orgUnitsService.findById(id, user.userId);
  }

  @Get('units/:id/children')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Get direct child units of an organization unit' })
  @ApiResponse({
    status: 200,
    description: 'List of direct child organization units',
    type: [OrgUnitEntity],
  })
  async findChildren(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.orgUnitsService.findChildren(id, user.userId);
  }

  @Get('units/:id/ancestors')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get ordered ancestors of an organization unit (root to parent)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of ancestor organization units in hierarchical order',
    type: [OrgUnitEntity],
  })
  async findAncestors(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.orgUnitsService.findAncestors(id, user.userId);
  }

  @Get('units/:id/descendants')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get flat list of all descendants of an organization unit',
  })
  @ApiResponse({
    status: 200,
    description: 'List of descendant organization units',
    type: [OrgUnitEntity],
  })
  async findDescendants(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.orgUnitsService.findDescendants(id, user.userId);
  }

  @Get('units/:id/change-log')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get structural change history log for an organization unit',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated change history log records',
  })
  async getChangeLog(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.orgUnitsService.getChangeLog(
      id,
      Number(page),
      Number(pageSize),
    );
  }

  @Get('units/:id/approval-chain')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get approval chain walking up hierarchy returning HEAD managers',
  })
  @ApiResponse({
    status: 200,
    description: 'List of hierarchical approval chain steps',
  })
  async getApprovalChain(@Param('id') id: string) {
    return this.orgUnitsService.getApprovalChain(id);
  }

  @Get('units/:id/budget-owner')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get nearest ancestor org unit with budget capability',
  })
  @ApiResponse({
    status: 200,
    description: 'Nearest ancestor unit with budget authority',
    type: OrgUnitEntity,
  })
  async getBudgetOwner(@Param('id') id: string) {
    return this.orgUnitsService.getBudgetOwner(id);
  }

  @Post('units')
  @RequirePermissions(ORG_PERMISSIONS.CREATE)
  @ApiOperation({ summary: 'Create a new organization unit' })
  @ApiResponse({
    status: 201,
    description: 'The created organization unit with breadcrumb and depth',
    type: OrgUnitDetailEntity,
  })
  async create(
    @Body() dto: CreateOrgUnitDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.orgUnitsService.create(dto, user.userId);
  }

  @Patch('units/:id')
  @RequirePermissions(ORG_PERMISSIONS.UPDATE)
  @ApiOperation({
    summary: 'Update organization unit non-structural attributes',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated organization unit details',
    type: OrgUnitDetailEntity,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrgUnitDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.orgUnitsService.update(id, dto, user.userId);
  }

  @Post('units/:id/move')
  @RequirePermissions(ORG_PERMISSIONS.MOVE)
  @ApiOperation({
    summary: 'Reparent an organization unit and its entire subtree',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated organization unit after structural move',
    type: OrgUnitDetailEntity,
  })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveOrgUnitDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.orgUnitsService.move(id, dto, user.userId);
  }

  @Post('units/:id/activate')
  @RequirePermissions(ORG_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Activate an organization unit' })
  @ApiResponse({
    status: 200,
    description: 'Activated organization unit',
    type: OrgUnitDetailEntity,
  })
  async activate(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.orgUnitsService.activate(id, user.userId);
  }

  @Post('units/:id/deactivate')
  @RequirePermissions(ORG_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Deactivate an organization unit' })
  @ApiResponse({
    status: 200,
    description: 'Deactivated organization unit',
    type: OrgUnitDetailEntity,
  })
  async deactivate(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.orgUnitsService.deactivate(id, user.userId);
  }

  @Delete('units/:id')
  @RequirePermissions(ORG_PERMISSIONS.DELETE)
  @ApiOperation({ summary: 'Soft delete an organization unit' })
  @ApiResponse({
    status: 200,
    description: 'Unit deleted successfully',
  })
  async remove(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    await this.orgUnitsService.softDelete(id, user.userId);
    return {
      success: true,
      message: 'Organization unit deleted successfully.',
    };
  }
}
