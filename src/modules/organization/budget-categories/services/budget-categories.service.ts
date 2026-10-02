import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BudgetCategoriesRepository } from '../repositories/budget-categories.repository';
import { CreateBudgetCategoryDto } from '../dto/create-budget-category.dto';
import { UpdateBudgetCategoryDto } from '../dto/update-budget-category.dto';
import { ListBudgetCategoriesDto } from '../dto/list-budget-categories.dto';
import { IBudgetCategory } from '../interfaces/budget-category.interface';

@Injectable()
export class BudgetCategoriesService {
  constructor(
    private readonly budgetCategoriesRepository: BudgetCategoriesRepository,
  ) {}

  async findAll(query?: ListBudgetCategoriesDto): Promise<IBudgetCategory[]> {
    return this.budgetCategoriesRepository.findAll(query);
  }

  async findById(id: string): Promise<IBudgetCategory> {
    const category = await this.budgetCategoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Budget category with ID '${id}' not found.`);
    }
    return category;
  }

  async create(dto: CreateBudgetCategoryDto): Promise<IBudgetCategory> {
    // Check if category with this code already exists in DB
    const existing = await this.budgetCategoriesRepository.findByCode(dto.code);

    if (existing) {
      if (existing.isActive) {
        // Active duplicate -> throw conflict error
        throw new ConflictException(
          `Budget category with code '${dto.code}' already exists.`,
        );
      } else {
        // Soft-deleted (inactive) duplicate -> Reactivate and update with newly passed values
        const updated = await this.budgetCategoriesRepository.update(
          existing.budgetCategoryId,
          {
            code: dto.code,
            name: dto.name,
            expenseType: dto.expenseType,
            oracleAccountCode: dto.oracleAccountCode,
            isActive: true, // Reactivate record
          },
        );
        return updated!;
      }
    }

    return this.budgetCategoriesRepository.create(dto);
  }

  async update(
    id: string | undefined,
    dto: UpdateBudgetCategoryDto,
  ): Promise<IBudgetCategory> {
    const targetId = dto.budgetCategoryId || id;
    if (!targetId) {
      throw new BadRequestException(
        'Budget category ID must be provided in either the URL parameter or request body.',
      );
    }

    const existingCategory = await this.findById(targetId);

    // If updating code, ensure new code is unique among active categories
    if (dto.code && dto.code.toLowerCase() !== existingCategory.code.toLowerCase()) {
      const codeDuplicate = await this.budgetCategoriesRepository.findByCode(
        dto.code,
      );
      if (
        codeDuplicate &&
        codeDuplicate.budgetCategoryId !== targetId &&
        codeDuplicate.isActive
      ) {
        throw new ConflictException(
          `Budget category with code '${dto.code}' already exists.`,
        );
      }
    }

    const updated = await this.budgetCategoriesRepository.update(targetId, dto);
    if (!updated) {
      throw new NotFoundException(`Budget category with ID '${targetId}' not found.`);
    }
    return updated;
  }

  async softDelete(id: string): Promise<{ success: boolean; message: string }> {
    await this.findById(id);
    await this.budgetCategoriesRepository.softDelete(id);
    return {
      success: true,
      message: `Budget category with ID '${id}' was soft-deleted successfully.`,
    };
  }
}
