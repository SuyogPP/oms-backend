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
  DESIGNATION_PERMISSIONS,
} from '../designations.constants';

import {
  CreateDesignationDto,
} from '../dto/create-designation.dto';

import {
  UpdateDesignationDto,
} from '../dto/update-designation.dto';

import {
  DesignationEntity,
} from '../entities/designation.entity';

import {
  DesignationsService,
} from '../services/designations.service';

@ApiTags('Salary & Grade - Designations')
@ApiBearerAuth()
@UseGuards(
  InternalUserGuard,
  PermissionGuard,
)
@Controller('salary-grade/designations')
export class DesignationsController {
  constructor(
    private readonly designationsService: DesignationsService,
  ) {}

  // ============================================================
  // GET ALL DESIGNATIONS
  // GET /api/v1/salary-grade/designations
  // ============================================================

  @Get()
  @RequirePermissions(
    DESIGNATION_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get paginated list of designations',
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
    example: 'Manager',
  })
  @ApiResponse({
    status: 200,
    description:
      'Designations retrieved successfully',
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
    return this.designationsService.findAll({
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
          ? isActive.toLowerCase() === 'true'
          : undefined,

      search,
    });
  }

  // ============================================================
  // GET DESIGNATION BY ID
  // GET /api/v1/salary-grade/designations/:id
  // ============================================================

  @Get(':id')
  @RequirePermissions(
    DESIGNATION_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get designation by ID',
  })
  @ApiResponse({
    status: 200,
    description:
      'Designation retrieved successfully',
    type: DesignationEntity,
  })
  @ApiResponse({
    status: 404,
    description:
      'Designation not found',
  })
  async findById(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,
  ): Promise<DesignationEntity> {
    return this.designationsService.findById(
      id,
    );
  }

  // ============================================================
  // CREATE DESIGNATION
  // POST /api/v1/salary-grade/designations
  // ============================================================

  @Post()
  @RequirePermissions(
    DESIGNATION_PERMISSIONS.CREATE,
  )
  @ApiOperation({
    summary:
      'Create a new designation',
  })
  @ApiResponse({
    status: 201,
    description:
      'Designation created successfully',
    type: DesignationEntity,
  })
  @ApiResponse({
    status: 409,
    description:
      'Designation code already exists',
  })
  async create(
    @Body()
    dto: CreateDesignationDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<DesignationEntity> {
    return this.designationsService.create(
      dto,
      user,
    );
  }

  // ============================================================
  // UPDATE DESIGNATION
  // PATCH /api/v1/salary-grade/designations/:id
  // ============================================================

  @Patch(':id')
  @RequirePermissions(
    DESIGNATION_PERMISSIONS.UPDATE,
  )
  @ApiOperation({
    summary:
      'Update an existing designation',
  })
  @ApiResponse({
    status: 200,
    description:
      'Designation updated successfully',
    type: DesignationEntity,
  })
  @ApiResponse({
    status: 404,
    description:
      'Designation not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Designation code already exists',
  })
  async update(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,

    @Body()
    dto: UpdateDesignationDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<DesignationEntity> {
    return this.designationsService.update(
      id,
      dto,
      user,
    );
  }

  // ============================================================
  // DELETE DESIGNATION
  // DELETE /api/v1/salary-grade/designations/:id
  // ============================================================

  @Delete(':id')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  @RequirePermissions(
    DESIGNATION_PERMISSIONS.DELETE,
  )
  @ApiOperation({
    summary:
      'Soft-delete a designation',
  })
  @ApiResponse({
    status: 204,
    description:
      'Designation deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description:
      'Designation not found',
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
    return this.designationsService.remove(
      id,
      user,
    );
  }
}