import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IBudgetCategory,
  IBudgetCategoryFilterOptions,
  ICreateBudgetCategoryData,
  IUpdateBudgetCategoryData,
} from '../interfaces/budget-category.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BudgetCategoriesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Maps raw database row to IBudgetCategory interface
   */
  private mapRow(row: any): IBudgetCategory {
    return {
      budgetCategoryId: String(row.budgetCategoryId),
      code: row.code,
      name: row.name,
      expenseType: row.expenseType,
      oracleAccountCode: row.oracleAccountCode || null,
      isActive: row.isActive === 1 || row.isActive === true,
    };
  }

  /**
   * Retrieves all budget categories with optional search and inactive filtering.
   */
  async findAll(
    options?: IBudgetCategoryFilterOptions,
    qr?: QueryRunner,
  ): Promise<IBudgetCategory[]> {
    const { search, includeInactive } = options || {};
    const params: any[] = [];
    let paramIndex = 0;

    let whereClause = includeInactive ? 'WHERE 1=1' : 'WHERE [is_active] = 1';

    if (search) {
      whereClause += ` AND (LOWER([code]) LIKE LOWER(@${paramIndex}) OR LOWER([name]) LIKE LOWER(@${paramIndex}))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const sql = `
      SELECT 
        [budget_category_id] AS budgetCategoryId,
        [code] AS code,
        [name] AS name,
        [expense_type] AS expenseType,
        [oracle_account_code] AS oracleAccountCode,
        [is_active] AS isActive
      FROM [masters].[tbl_Budget_Categories]
      ${whereClause}
      ORDER BY [code] ASC;
    `;

    const rows = await this.getExecutor(qr).query(sql, params);
    return rows.map((r: any) => this.mapRow(r));
  }

  /**
   * Retrieves a budget category by ID.
   */
  async findById(
    id: string,
    qr?: QueryRunner,
  ): Promise<IBudgetCategory | null> {
    const sql = `
      SELECT 
        [budget_category_id] AS budgetCategoryId,
        [code] AS code,
        [name] AS name,
        [expense_type] AS expenseType,
        [oracle_account_code] AS oracleAccountCode,
        [is_active] AS isActive
      FROM [masters].[tbl_Budget_Categories]
      WHERE [budget_category_id] = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [id]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  /**
   * Retrieves a budget category by Code.
   */
  async findByCode(
    code: string,
    qr?: QueryRunner,
  ): Promise<IBudgetCategory | null> {
    const sql = `
      SELECT 
        [budget_category_id] AS budgetCategoryId,
        [code] AS code,
        [name] AS name,
        [expense_type] AS expenseType,
        [oracle_account_code] AS oracleAccountCode,
        [is_active] AS isActive
      FROM [masters].[tbl_Budget_Categories]
      WHERE LOWER([code]) = LOWER(@0);
    `;
    const rows = await this.getExecutor(qr).query(sql, [code]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  /**
   * Inserts a new budget category into [masters].[tbl_Budget_Categories].
   */
  async create(
    data: ICreateBudgetCategoryData,
    qr?: QueryRunner,
  ): Promise<IBudgetCategory> {
    const budgetCategoryId = data.budgetCategoryId || uuidv4();
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1;

    const sql = `
      INSERT INTO [masters].[tbl_Budget_Categories] (
        [budget_category_id],
        [code],
        [name],
        [expense_type],
        [oracle_account_code],
        [is_active]
      )
      VALUES (@0, @1, @2, @3, @4, @5);
    `;

    await this.getExecutor(qr).query(sql, [
      budgetCategoryId,
      data.code,
      data.name,
      data.expenseType,
      data.oracleAccountCode || null,
      isActive,
    ]);

    return (await this.findById(budgetCategoryId, qr))!;
  }

  /**
   * Updates only modified fields of an existing budget category.
   */
  async update(
    id: string,
    data: IUpdateBudgetCategoryData,
    qr?: QueryRunner,
  ): Promise<IBudgetCategory | null> {
    const fields: string[] = [];
    const params: any[] = [id];
    let paramIndex = 1;

    if (data.code !== undefined) {
      fields.push(`[code] = @${paramIndex++}`);
      params.push(data.code);
    }
    if (data.name !== undefined) {
      fields.push(`[name] = @${paramIndex++}`);
      params.push(data.name);
    }
    if (data.expenseType !== undefined) {
      fields.push(`[expense_type] = @${paramIndex++}`);
      params.push(data.expenseType);
    }
    if (data.oracleAccountCode !== undefined) {
      fields.push(`[oracle_account_code] = @${paramIndex++}`);
      params.push(data.oracleAccountCode);
    }
    if (data.isActive !== undefined) {
      fields.push(`[is_active] = @${paramIndex++}`);
      params.push(data.isActive ? 1 : 0);
    }

    if (fields.length > 0) {
      const sql = `
        UPDATE [masters].[tbl_Budget_Categories]
        SET ${fields.join(', ')}
        WHERE [budget_category_id] = @0;
      `;
      await this.getExecutor(qr).query(sql, params);
    }

    return this.findById(id, qr);
  }

  /**
   * Soft deletes a budget category by setting is_active = 0.
   */
  async softDelete(id: string, qr?: QueryRunner): Promise<boolean> {
    const sql = `
      UPDATE [masters].[tbl_Budget_Categories]
      SET [is_active] = 0
      WHERE [budget_category_id] = @0;
    `;
    await this.getExecutor(qr).query(sql, [id]);
    return true;
  }
}
