import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { UserScopesService } from '../services/user-scopes.service';
import { AssignScopeDto, ScopeCountResponseDto } from '../dto/assign-scope.dto';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';
import { USER_PERMISSIONS } from '../../users/users.constants';

@ApiTags('Authorization - Scope Assignments')
@ApiBearerAuth('JWT')
@Controller('authorization/users')
export class UserScopesController {
  constructor(private readonly userScopesService: UserScopesService) {}

  @Get(':id/scopes')
  @RequirePermissions(USER_PERMISSIONS.VIEW)
  @UseGuards(PermissionGuard)
  @ApiOperation({ summary: 'Get all scope assignments for a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of scope assignments retrieved',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findByUserId(
    @Param('id') id: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.userScopesService.findByUserId(id, currentUser?.userId);
  }

  @Post(':id/scopes')
  @RequirePermissions(USER_PERMISSIONS.SCOPE_ASSIGN)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Assign organizational scope to a user (enforces Rules S1-S6)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Scope assigned successfully',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid scope column or org unit type mismatch (S1/S2/S5)' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Scope escalation or missing permission (S3/S4)' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Self-assignment or duplicate scope (S6/U14)' })
  async assignScope(
    @Param('id') id: string,
    @Body() dto: AssignScopeDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    return this.userScopesService.assignScope(id, dto, currentUser?.userId);
  }

  @Delete(':id/scopes/:scopeId')
  @RequirePermissions(USER_PERMISSIONS.SCOPE_ASSIGN)
  @UseGuards(PermissionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke organizational scope (S7 sets EffectiveTo=now, S8 prevents removing last scope)',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiParam({ name: 'scopeId', description: 'UserOrganizationScope UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scope assignment revoked successfully',
  })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Cannot revoke self scope or last remaining scope (S8/U14)' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Scope assignment not found' })
  async revokeScope(
    @Param('scopeId') scopeId: string,
    @CurrentUser() currentUser?: ICurrentUser,
  ) {
    await this.userScopesService.revokeScope(scopeId, currentUser?.userId);
    return {
      success: true,
      message: 'Scope assignment revoked successfully.',
    };
  }

  @Get('scopes/preview-coverage')
  @RequirePermissions(USER_PERMISSIONS.VIEW)
  @UseGuards(PermissionGuard)
  @ApiOperation({
    summary: 'Preview the count of accessible organizational units for a proposed scope',
  })
  @ApiQuery({ name: 'scopeDefinitionId', description: 'ScopeDefinition UUID' })
  @ApiQuery({ name: 'orgUnitId', required: false, description: 'Root OrgUnit UUID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Accessible org units count calculated',
    type: ScopeCountResponseDto,
  })
  async previewCoverage(
    @Query('scopeDefinitionId') scopeDefinitionId: string,
    @Query('orgUnitId') orgUnitId?: string,
  ): Promise<ScopeCountResponseDto> {
    return this.userScopesService.countProposedScopeUnits(
      scopeDefinitionId,
      orgUnitId,
    );
  }
}
