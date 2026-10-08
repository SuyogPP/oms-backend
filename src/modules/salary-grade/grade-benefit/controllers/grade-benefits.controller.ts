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

import {
  CurrentUser,
} from '../../../auth/decorators/current-user.decorator';

import {
  RequirePermissions,
} from '../../../auth/decorators/permissions.decorator';

import {
  PermissionGuard,
} from '../../../auth/guards/permissions.guard';

import type {
  CurrentUser as ICurrentUser,
} from '../../../auth/interfaces/current-user.interface';

import {
  InternalUserGuard,
} from '../../../organization/org-scope/guards/internal-user.guard';

import {
  GRADE_BENEFIT_PERMISSIONS,
} from '../grade-benefit.constants';

import {
  CreateGradeBenefitDto,
} from '../dto/create-grade-benefit.dto';

import {
  UpdateGradeBenefitDto,
} from '../dto/update-grade-benefit.dto';

import {
  GradeBenefitEntity,
} from '../entities/grade-benefit.entity';

import {
  GradeBenefitsService,
} from '../services/grade-benefits.service';

@ApiTags('Salary & Grade - Configurations')
@ApiBearerAuth()
@UseGuards(
  InternalUserGuard,
  PermissionGuard,
)
@Controller('salary-grade/configurations')
export class GradeBenefitsController {
  constructor(
    private readonly gradeBenefitsService: GradeBenefitsService,
  ) {}

  @Get()
  @RequirePermissions(
    GRADE_BENEFIT_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get Salary & Grade configurations',
  })
  @ApiQuery({
    name: 'deploymentId',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
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
  async findAll(
    @Query('deploymentId')
    deploymentId?: string,

    @Query('isActive')
    isActive?: string,

    @Query('search')
    search?: string,

    @Query('page')
    page?: string,

    @Query('pageSize')
    pageSize?: string,
  ) {
    return this.gradeBenefitsService.findAll({
      deploymentId,

      isActive:
        isActive !== undefined
          ? isActive.toLowerCase() ===
            'true'
          : undefined,

      search,

      page:
        page !== undefined
          ? Number(page)
          : 1,

      pageSize:
        pageSize !== undefined
          ? Number(pageSize)
          : 20,
    });
  }

  @Get(':id')
  @RequirePermissions(
    GRADE_BENEFIT_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get Salary & Grade configuration by ID',
  })
  @ApiResponse({
    status: 200,
    type: GradeBenefitEntity,
  })
  async findById(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,
  ): Promise<GradeBenefitEntity> {
    return this.gradeBenefitsService.findById(
      id,
    );
  }

  @Post()
  @RequirePermissions(
    GRADE_BENEFIT_PERMISSIONS.CREATE,
  )
  @ApiOperation({
    summary:
      'Create Salary & Grade configuration',
  })
  @ApiResponse({
    status: 201,
    type: GradeBenefitEntity,
  })
  async create(
    @Body()
    dto: CreateGradeBenefitDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<GradeBenefitEntity> {
    return this.gradeBenefitsService.create(
      dto,
      user,
    );
  }

  @Patch(':id')
  @RequirePermissions(
    GRADE_BENEFIT_PERMISSIONS.UPDATE,
  )
  @ApiOperation({
    summary:
      'Update Salary & Grade configuration',
  })
  async update(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,

    @Body()
    dto: UpdateGradeBenefitDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<GradeBenefitEntity> {
    return this.gradeBenefitsService.update(
      id,
      dto,
      user,
    );
  }

  @Delete(':id')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  @RequirePermissions(
    GRADE_BENEFIT_PERMISSIONS.DELETE,
  )
  @ApiOperation({
    summary:
      'Soft-delete Salary & Grade configuration',
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
    return this.gradeBenefitsService.remove(
      id,
      user,
    );
  }
}