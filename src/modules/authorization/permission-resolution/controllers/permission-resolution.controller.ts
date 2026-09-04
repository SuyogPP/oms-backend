import { Controller, Get, Param, UseGuards, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { EffectivePermissionsService } from '../services/effective-permissions.service';
import { GetEffectivePermissionsParamDto } from '../dto/get-effective-permissions.dto';
import { EffectivePermissionsResponseEntity } from '../entities/effective-permissions.entity';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { CurrentUser as ICurrentUser } from '../../../auth/interfaces/current-user.interface';

@ApiTags('Authorization - Permission Resolution')
@ApiBearerAuth('JWT')
@Controller('authorization/users')
export class PermissionResolutionController {
  constructor(
    private readonly effectivePermissionsService: EffectivePermissionsService,
  ) {}

  /**
   * Preview effective permissions and complete audit trail for a user per Spec §4.6.
   * Returns each permission with its originating source (ROLE, ROLE_INHERITED,
   * OVERRIDE_GRANT, DELEGATION) and list of revoked permissions.
   *
   * Security & Scoping (§9.2):
   * - Protected by USER.VIEW permission.
   * - Scope-filtered: Out-of-scope target user returns 404 (Not Found).
   */
  @Get(':id/effective-permissions')
  @RequirePermissions('USER.VIEW')
  @UseGuards(PermissionGuard)
  @ApiOperation({
    summary: 'Get Effective Permissions Preview & Audit Trail',
    description:
      'Resolves all direct, inherited, overridden, and delegated permissions for a user with source attribution and scope filtering.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Target User UUID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Effective permissions resolved successfully',
    type: EffectivePermissionsResponseEntity,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthenticated or invalid session token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions (Requires USER.VIEW)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'User not found or target user is out of requester scope (404)',
  })
  async getEffectivePermissions(
    @Param() params: GetEffectivePermissionsParamDto,
    @CurrentUser() currentUser?: ICurrentUser,
  ): Promise<EffectivePermissionsResponseEntity> {
    const requesterUserId = currentUser?.userId;
    return this.effectivePermissionsService.getEffectivePermissionsPreview(
      params.id,
      requesterUserId,
    );
  }
}
