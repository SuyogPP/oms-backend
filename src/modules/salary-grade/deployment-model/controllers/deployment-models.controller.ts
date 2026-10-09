import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';

import { PermissionGuard } from '../../../auth/guards/permissions.guard';

import { InternalUserGuard } from '../../../organization/org-scope/guards/internal-user.guard';

import {
  DEPLOYMENT_MODEL_PERMISSIONS,
} from '../deployment-model.constants';

import {
  DeploymentModelEntity,
} from '../entities/deployment-model.entity';

import {
  DeploymentModelsService,
} from '../services/deployment-models.service';

@ApiTags('Salary & Grade - Deployment Models')
@ApiBearerAuth()
@UseGuards(
  InternalUserGuard,
  PermissionGuard,
)
@Controller('salary-grade/deployment-models')
export class DeploymentModelsController {
  constructor(
    private readonly deploymentModelsService: DeploymentModelsService,
  ) {}

  // ============================================================
  // GET ALL DEPLOYMENT MODELS
  // ============================================================

  @Get()
  @RequirePermissions(
    DEPLOYMENT_MODEL_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get deployment models',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    example: 'Onsite',
  })
  @ApiResponse({
    status: 200,
    description:
      'Deployment models retrieved successfully',
    type: [DeploymentModelEntity],
  })
  async findAll(
    @Query('isActive')
    isActive?: string,

    @Query('search')
    search?: string,
  ): Promise<DeploymentModelEntity[]> {
    return this.deploymentModelsService.findAll({
      isActive:
        isActive !== undefined
          ? isActive.toLowerCase() ===
            'true'
          : undefined,

      search,
    });
  }

  // ============================================================
  // GET DEPLOYMENT MODEL BY ID
  // ============================================================

  @Get(':id')
  @RequirePermissions(
    DEPLOYMENT_MODEL_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get deployment model by ID',
  })
  @ApiResponse({
    status: 200,
    description:
      'Deployment model retrieved successfully',
    type: DeploymentModelEntity,
  })
  @ApiResponse({
    status: 404,
    description:
      'Deployment model not found',
  })
  async findById(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,
  ): Promise<DeploymentModelEntity> {
    return this.deploymentModelsService.findById(
      id,
    );
  }
}