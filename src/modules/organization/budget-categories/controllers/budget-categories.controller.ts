import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../auth/decorators/public.decorator';
import { BudgetCategoriesService } from '../services/budget-categories.service';
import { CreateBudgetCategoryDto } from '../dto/create-budget-category.dto';
import { UpdateBudgetCategoryDto } from '../dto/update-budget-category.dto';
import { ListBudgetCategoriesDto } from '../dto/list-budget-categories.dto';
import { BudgetCategoryEntity } from '../entities/budget-category.entity';

@ApiTags('Budget Categories')
@ApiBearerAuth()
// Public decorator allows calling this controller without token or cookies during testing
@Public()
@Controller('budget-categories')
export class BudgetCategoriesController {
  constructor(
    private readonly budgetCategoriesService: BudgetCategoriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all budget categories' })
  @ApiResponse({
    status: 200,
    description: 'List of budget categories',
    type: [BudgetCategoryEntity],
  })
  async findAll(@Query() query: ListBudgetCategoriesDto) {
    return this.budgetCategoriesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get budget category by ID' })
  @ApiResponse({
    status: 200,
    description: 'Budget category details',
    type: BudgetCategoryEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Budget category not found',
  })
  async findById(@Param('id') id: string) {
    return this.budgetCategoriesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new budget category (UUID auto-generated)' })
  @ApiResponse({
    status: 201,
    description: 'Budget category created successfully',
    type: BudgetCategoryEntity,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Code already exists',
  })
  async create(@Body() dto: CreateBudgetCategoryDto) {
    return this.budgetCategoriesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update budget category by ID in URL param (modifies only passed fields)',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget category updated successfully',
    type: BudgetCategoryEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Budget category not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - New code already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetCategoryDto,
  ) {
    return this.budgetCategoriesService.update(id, dto);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update budget category by passing budgetCategoryId in body (modifies only passed fields)',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget category updated successfully',
    type: BudgetCategoryEntity,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing budgetCategoryId in body',
  })
  @ApiResponse({
    status: 404,
    description: 'Budget category not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - New code already exists',
  })
  async updateByBody(@Body() dto: UpdateBudgetCategoryDto) {
    return this.budgetCategoriesService.update(dto.budgetCategoryId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete budget category (sets is_active = 0)' })
  @ApiResponse({
    status: 200,
    description: 'Budget category soft-deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Budget category not found',
  })
  async remove(@Param('id') id: string) {
    return this.budgetCategoriesService.softDelete(id);
  }
}
