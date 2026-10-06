import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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

import { CurrentUser } from '../../../auth/decorators/current-user.decorator';

import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';

import { PermissionGuard } from '../../../auth/guards/permissions.guard';

import type {
  CurrentUser as ICurrentUser,
} from '../../../auth/interfaces/current-user.interface';

import { InternalUserGuard } from '../../../organization/org-scope/guards/internal-user.guard';

import {
  DEPENDENCY_TIER_PERMISSIONS,
} from '../dependency-tier.constants';

import {
  CreateDependencyTierDto,
} from '../dto/create-dependency-tier.dto';

import {
  UpdateDependencyTierDto,
} from '../dto/update-dependency-tier.dto';

import {
  DependencyTierEntity,
} from '../entities/dependency-tier.entity';

import {
  DependencyTiersService,
} from '../services/dependency-tiers.service';

@ApiTags('Salary & Grade - Dependency Tiers')
@ApiBearerAuth()
@UseGuards(
  InternalUserGuard,
  PermissionGuard,
)
@Controller('salary-grade/dependency-tiers')
export class DependencyTiersController {
  constructor(
    private readonly dependencyTiersService: DependencyTiersService,
  ) {}

  // ============================================================
  // GET ALL
  // ============================================================

  @Get()
  @RequirePermissions(
    DEPENDENCY_TIER_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get paginated list of dependency tiers',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    example: 20,
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
    example: 'TIER',
  })
  @ApiResponse({
    status: 200,
    description:
      'Dependency tiers retrieved successfully',
  })
  async findAll(
    @Query('page')
    page?: string,

    @Query('pageSize')
    pageSize?: string,

    @Query('isActive')
    isActive?: string,

    @Query('search')
    search?: string,
  ) {
    return this.dependencyTiersService.findAll({
      page:
        page !== undefined
          ? Number(page)
          : 1,

      pageSize:
        pageSize !== undefined
          ? Number(pageSize)
          : 20,

      isActive:
        isActive !== undefined
          ? isActive.toLowerCase() ===
            'true'
          : undefined,

      search,
    });
  }

  // ============================================================
  // GET BY ID
  // ============================================================

  @Get(':id')
  @RequirePermissions(
    DEPENDENCY_TIER_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get dependency tier by ID',
  })
  @ApiResponse({
    status: 200,
    description:
      'Dependency tier retrieved successfully',
    type: DependencyTierEntity,
  })
  @ApiResponse({
    status: 404,
    description:
      'Dependency tier not found',
  })
  async findById(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,
  ): Promise<DependencyTierEntity> {
    return this.dependencyTiersService.findById(
      id,
    );
  }

  // ============================================================
  // CREATE
  // ============================================================

  @Post()
  @RequirePermissions(
    DEPENDENCY_TIER_PERMISSIONS.CREATE,
  )
  @ApiOperation({
    summary:
      'Create a new dependency tier',
  })
  @ApiResponse({
    status: 201,
    description:
      'Dependency tier created successfully',
    type: DependencyTierEntity,
  })
  @ApiResponse({
    status: 409,
    description:
      'Dependency tier code already exists',
  })
  async create(
    @Body()
    dto: CreateDependencyTierDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<DependencyTierEntity> {
    return this.dependencyTiersService.create(
      dto,
      user,
    );
  }

  // ============================================================
  // UPDATE
  // ============================================================

  @Patch(':id')
  @RequirePermissions(
    DEPENDENCY_TIER_PERMISSIONS.UPDATE,
  )
  @ApiOperation({
    summary:
      'Update an existing dependency tier',
  })
  @ApiResponse({
    status: 200,
    description:
      'Dependency tier updated successfully',
    type: DependencyTierEntity,
  })
  @ApiResponse({
    status: 404,
    description:
      'Dependency tier not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Dependency tier code already exists',
  })
  async update(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,

    @Body()
    dto: UpdateDependencyTierDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<DependencyTierEntity> {
    return this.dependencyTiersService.update(
      id,
      dto,
      user,
    );
  }

  // ============================================================
  // DELETE
  // ============================================================

  @Delete(':id')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  @RequirePermissions(
    DEPENDENCY_TIER_PERMISSIONS.DELETE,
  )
  @ApiOperation({
    summary:
      'Soft-delete a dependency tier',
  })
  @ApiResponse({
    status: 204,
    description:
      'Dependency tier deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description:
      'Dependency tier not found',
  })
  async remove(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<void> {
    return this.dependencyTiersService.remove(
      id,
      user,
    );
  }
}