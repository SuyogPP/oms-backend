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
  BENEFIT_PERMISSIONS,
} from '../benefit.constants';

import {
  CreateBenefitDto,
} from '../dto/create-benefit.dto';

import {
  UpdateBenefitDto,
} from '../dto/update-benefit.dto';

import {
  BenefitEntity,
} from '../entities/benefit.entity';

import {
  BenefitsService,
} from '../services/benefits.service';

@ApiTags('Salary & Grade - Benefits')
@ApiBearerAuth()
@UseGuards(
  InternalUserGuard,
  PermissionGuard,
)
@Controller('salary-grade/benefits')
export class BenefitsController {
  constructor(
    private readonly benefitsService: BenefitsService,
  ) {}

  @Get()
  @RequirePermissions(
    BENEFIT_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get paginated list of benefits',
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
    example: 'Medical',
  })
  @ApiResponse({
    status: 200,
    description:
      'Benefits retrieved successfully',
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
    return this.benefitsService.findAll({
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

  @Get(':id')
  @RequirePermissions(
    BENEFIT_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get benefit by ID',
  })
  @ApiResponse({
    status: 200,
    description:
      'Benefit retrieved successfully',
    type: BenefitEntity,
  })
  async findById(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,
  ): Promise<BenefitEntity> {
    return this.benefitsService.findById(
      id,
    );
  }

  @Post()
  @RequirePermissions(
    BENEFIT_PERMISSIONS.CREATE,
  )
  @ApiOperation({
    summary:
      'Create a new benefit',
  })
  @ApiResponse({
    status: 201,
    description:
      'Benefit created successfully',
    type: BenefitEntity,
  })
  @ApiResponse({
    status: 409,
    description:
      'Benefit name already exists',
  })
  async create(
    @Body()
    dto: CreateBenefitDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<BenefitEntity> {
    return this.benefitsService.create(
      dto,
      user,
    );
  }

  @Patch(':id')
  @RequirePermissions(
    BENEFIT_PERMISSIONS.UPDATE,
  )
  @ApiOperation({
    summary:
      'Update an existing benefit',
  })
  @ApiResponse({
    status: 200,
    description:
      'Benefit updated successfully',
    type: BenefitEntity,
  })
  async update(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,

    @Body()
    dto: UpdateBenefitDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<BenefitEntity> {
    return this.benefitsService.update(
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
    BENEFIT_PERMISSIONS.DELETE,
  )
  @ApiOperation({
    summary:
      'Soft-delete a benefit',
  })
  @ApiResponse({
    status: 204,
    description:
      'Benefit deleted successfully',
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
    return this.benefitsService.remove(
      id,
      user,
    );
  }
}