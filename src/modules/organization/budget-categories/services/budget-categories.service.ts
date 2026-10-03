import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BudgetCategoriesRepository } from '../repositories/budget-categories.repository';
import { AuditLogRepository } from '../../../audit/repositories/audit-log.repository';
import { CreateBudgetCategoryDto } from '../dto/create-budget-category.dto';
import { UpdateBudgetCategoryDto } from '../dto/update-budget-category.dto';
import { ListBudgetCategoriesDto } from '../dto/list-budget-categories.dto';
import { IBudgetCategory } from '../interfaces/budget-category.interface';

export interface IAuditMeta {
  userId?: string;
  userName?: string;
  ip?: string;
}

@Injectable()
export class BudgetCategoriesService {
  constructor(
    private readonly budgetCategoriesRepository: BudgetCategoriesRepository,
    private readonly auditLogRepository: AuditLogRepository,
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

  async create(
    dto: CreateBudgetCategoryDto,
    meta?: IAuditMeta,
  ): Promise<IBudgetCategory> {
    // Check if category with this code already exists in DB
    const existing = await this.budgetCategoriesRepository.findByCode(dto.code);

    let resultCategory: IBudgetCategory;
    let oldValues: string | null = null;
    let operation = 'INSERT';

    if (existing) {
      if (existing.isActive) {
        // Active duplicate -> throw conflict error
        throw new ConflictException(
          `Budget category with code '${dto.code}' already exists.`,
        );
      } else {
        // Soft-deleted (inactive) duplicate -> Reactivate and update with newly passed values
        oldValues = JSON.stringify(existing);
        operation = 'UPDATE';
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
        resultCategory = updated!;
      }
    } else {
      resultCategory = await this.budgetCategoriesRepository.create(dto);
    }

    // Write audit log entry
    await this.auditLogRepository.insert({
      table_name: 'tbl_Budget_Categories',
      schema_name: 'masters',
      operation,
      record_id_text: resultCategory.budgetCategoryId,
      performed_by: meta?.userId || null,
      performed_by_name: meta?.userName || null,
      source_module: 'BudgetCategoriesModule',
      old_values: oldValues,
      new_values: JSON.stringify(resultCategory),
      client_ip: meta?.ip || null,
    });

    return resultCategory;
  }

  async update(
    id: string | undefined,
    dto: UpdateBudgetCategoryDto,
    meta?: IAuditMeta,
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

    // Write audit log entry
    await this.auditLogRepository.insert({
      table_name: 'tbl_Budget_Categories',
      schema_name: 'masters',
      operation: 'UPDATE',
      record_id_text: updated.budgetCategoryId,
      performed_by: meta?.userId || null,
      performed_by_name: meta?.userName || null,
      source_module: 'BudgetCategoriesModule',
      old_values: JSON.stringify(existingCategory),
      new_values: JSON.stringify(updated),
      client_ip: meta?.ip || null,
    });

    return updated;
  }

  async softDelete(
    id: string,
    meta?: IAuditMeta,
  ): Promise<{ success: boolean; message: string }> {
    const existingCategory = await this.findById(id);
    await this.budgetCategoriesRepository.softDelete(id);

    const deletedState = { ...existingCategory, isActive: false };

    // Write audit log entry
    await this.auditLogRepository.insert({
      table_name: 'tbl_Budget_Categories',
      schema_name: 'masters',
      operation: 'DELETE',
      record_id_text: id,
      performed_by: meta?.userId || null,
      performed_by_name: meta?.userName || null,
      source_module: 'BudgetCategoriesModule',
      old_values: JSON.stringify(existingCategory),
      new_values: JSON.stringify(deletedState),
      client_ip: meta?.ip || null,
    });

    return {
      success: true,
      message: `Budget category with ID '${id}' was soft-deleted successfully.`,
    };
  }
}
