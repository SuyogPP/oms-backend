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
  GRADE_PERMISSIONS,
} from '../grades.constants';

import {
  CreateGradeDto,
} from '../dto/create-grade.dto';

import {
  UpdateGradeDto,
} from '../dto/update-grade.dto';

import {
  GradeEntity,
} from '../entities/grade.entity';

import {
  GradesService,
} from '../services/grades.service';

@ApiTags('Salary & Grade - Grades')
@ApiBearerAuth()
@UseGuards(
  InternalUserGuard,
  PermissionGuard,
)
@Controller('salary-grade/grades')
export class GradesController {
  constructor(
    private readonly gradesService: GradesService,
  ) {}

  // ============================================================
  // GET ALL GRADES
  // GET /api/v1/salary-grade/grades
  // ============================================================

  @Get()
  @RequirePermissions(
    GRADE_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get paginated list of grades',
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
    example: 'Senior',
  })
  @ApiResponse({
    status: 200,
    description:
      'Grades retrieved successfully',
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
    return this.gradesService.findAll({
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
  // GET GRADE BY ID
  // GET /api/v1/salary-grade/grades/:id
  // ============================================================

  @Get(':id')
  @RequirePermissions(
    GRADE_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get grade by ID',
  })
  @ApiResponse({
    status: 200,
    description:
      'Grade retrieved successfully',
    type: GradeEntity,
  })
  @ApiResponse({
    status: 404,
    description:
      'Grade not found',
  })
  async findById(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,
  ): Promise<GradeEntity> {
    return this.gradesService.findById(
      id,
    );
  }

  // ============================================================
  // CREATE GRADE
  // POST /api/v1/salary-grade/grades
  // ============================================================

  @Post()
  @RequirePermissions(
    GRADE_PERMISSIONS.CREATE,
  )
  @ApiOperation({
    summary:
      'Create a new grade',
  })
  @ApiResponse({
    status: 201,
    description:
      'Grade created successfully',
    type: GradeEntity,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid salary range',
  })
  @ApiResponse({
    status: 409,
    description:
      'Grade code already exists',
  })
  async create(
    @Body()
    dto: CreateGradeDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<GradeEntity> {
    return this.gradesService.create(
      dto,
      user,
    );
  }

  // ============================================================
  // UPDATE GRADE
  // PATCH /api/v1/salary-grade/grades/:id
  // ============================================================

  @Patch(':id')
  @RequirePermissions(
    GRADE_PERMISSIONS.UPDATE,
  )
  @ApiOperation({
    summary:
      'Update an existing grade',
  })
  @ApiResponse({
    status: 200,
    description:
      'Grade updated successfully',
    type: GradeEntity,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid salary range',
  })
  @ApiResponse({
    status: 404,
    description:
      'Grade not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Grade code already exists',
  })
  async update(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,

    @Body()
    dto: UpdateGradeDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<GradeEntity> {
    return this.gradesService.update(
      id,
      dto,
      user,
    );
  }

  // ============================================================
  // DELETE GRADE
  // DELETE /api/v1/salary-grade/grades/:id
  // ============================================================

  @Delete(':id')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  @RequirePermissions(
    GRADE_PERMISSIONS.DELETE,
  )
  @ApiOperation({
    summary:
      'Soft-delete a grade',
  })
  @ApiResponse({
    status: 204,
    description:
      'Grade deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description:
      'Grade not found',
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
    return this.gradesService.remove(
      id,
      user,
    );
  }
}