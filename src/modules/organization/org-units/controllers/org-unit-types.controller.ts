import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { PermissionGuard } from '../../../auth/guards/permissions.guard';
import { AuditInterceptor } from '../../../audit/interceptor/audit.interceptor';
import { InternalUserGuard } from '../../org-scope/guards/internal-user.guard';
import { OrgUnitTypeEntity } from '../entities/org-unit-type.entity';
import { ORG_PERMISSIONS } from '../org-units.constants';
import { OrgUnitTypesService } from '../services/org-unit-types.service';

@ApiTags('Organization Types')
@ApiBearerAuth()
@UseGuards(InternalUserGuard, PermissionGuard)
@UseInterceptors(AuditInterceptor)
@Controller('organization/unit-types')
export class OrgUnitTypesController {
  constructor(private readonly typesService: OrgUnitTypesService) {}

  @Get()
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get all organization unit types with permitted hierarchy rules',
  })
  @ApiResponse({
    status: 200,
    description: 'List of organization unit types with allowed child type IDs',
    type: [OrgUnitTypeEntity],
  })
  async findAll(): Promise<OrgUnitTypeEntity[]> {
    return this.typesService.findAllTypes();
  }

  @Get(':id/allowed-parents')
  @RequirePermissions(ORG_PERMISSIONS.VIEW)
  @ApiOperation({
    summary: 'Get allowed parent unit types for a given child unit type',
  })
  @ApiResponse({
    status: 200,
    description: 'List of permitted parent unit types',
    type: [OrgUnitTypeEntity],
  })
  async findAllowedParents(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OrgUnitTypeEntity[]> {
    return this.typesService.findAllowedParents(id);
  }
}
