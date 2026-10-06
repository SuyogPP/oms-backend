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

import { CATEGORY_PERMISSIONS } from '../categories.constants';

import { CreateCategoryDto } from '../dto/create-category.dto';

import { UpdateCategoryDto } from '../dto/update-category.dto';

import { CategoryEntity } from '../entities/category.entity';

import { CategoriesService } from '../services/categories.service';

@ApiTags('Salary & Grade - Categories')
@ApiBearerAuth()
@UseGuards(
  InternalUserGuard,
  PermissionGuard,
)
@Controller('salary-grade/categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
  ) {}

  // ============================================================
  // GET ALL CATEGORIES
  // GET /api/v1/salary-grade/categories
  // ============================================================

  @Get()
  @RequirePermissions(
    CATEGORY_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get paginated list of categories',
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
    example: 'Management',
  })
  @ApiResponse({
    status: 200,
    description:
      'Categories retrieved successfully',
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
    return this.categoriesService.findAll({
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
  // GET CATEGORY BY ID
  // GET /api/v1/salary-grade/categories/:id
  // ============================================================

  @Get(':id')
  @RequirePermissions(
    CATEGORY_PERMISSIONS.VIEW,
  )
  @ApiOperation({
    summary:
      'Get category by ID',
  })
  @ApiResponse({
    status: 200,
    description:
      'Category retrieved successfully',
    type: CategoryEntity,
  })
  @ApiResponse({
    status: 404,
    description:
      'Category not found',
  })
  async findById(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,
  ): Promise<CategoryEntity> {
    return this.categoriesService.findById(
      id,
    );
  }

  // ============================================================
  // CREATE CATEGORY
  // POST /api/v1/salary-grade/categories
  // ============================================================

  @Post()
  @RequirePermissions(
    CATEGORY_PERMISSIONS.CREATE,
  )
  @ApiOperation({
    summary:
      'Create a new category',
  })
  @ApiResponse({
    status: 201,
    description:
      'Category created successfully',
    type: CategoryEntity,
  })
  @ApiResponse({
    status: 409,
    description:
      'Category code already exists',
  })
  async create(
    @Body()
    dto: CreateCategoryDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<CategoryEntity> {
    return this.categoriesService.create(
      dto,
      user,
    );
  }

  // ============================================================
  // UPDATE CATEGORY
  // PATCH /api/v1/salary-grade/categories/:id
  // ============================================================

  @Patch(':id')
  @RequirePermissions(
    CATEGORY_PERMISSIONS.UPDATE,
  )
  @ApiOperation({
    summary:
      'Update an existing category',
  })
  @ApiResponse({
    status: 200,
    description:
      'Category updated successfully',
    type: CategoryEntity,
  })
  @ApiResponse({
    status: 404,
    description:
      'Category not found',
  })
  @ApiResponse({
    status: 409,
    description:
      'Category code already exists',
  })
  async update(
    @Param(
      'id',
      ParseUUIDPipe,
    )
    id: string,

    @Body()
    dto: UpdateCategoryDto,

    @CurrentUser()
    user: ICurrentUser,
  ): Promise<CategoryEntity> {
    return this.categoriesService.update(
      id,
      dto,
      user,
    );
  }

  // ============================================================
  // DELETE CATEGORY
  // DELETE /api/v1/salary-grade/categories/:id
  // ============================================================

  @Delete(':id')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  @RequirePermissions(
    CATEGORY_PERMISSIONS.DELETE,
  )
  @ApiOperation({
    summary:
      'Soft-delete a category',
  })
  @ApiResponse({
    status: 204,
    description:
      'Category deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description:
      'Category not found',
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
    return this.categoriesService.remove(
      id,
      user,
    );
  }
}