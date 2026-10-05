import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IFiscalYear,
  IFiscalYearFilterOptions,
  ICreateFiscalYearData,
  IUpdateFiscalYearData,
} from '../interfaces/fiscal-year.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FiscalYearsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  private formatDate(dateVal: any): string | null {
    if (!dateVal) return null;
    if (dateVal instanceof Date) {
      const year = dateVal.getFullYear();
      const month = String(dateVal.getMonth() + 1).padStart(2, '0');
      const day = String(dateVal.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const str = String(dateVal).trim();
    if (!str) return null;
    return str.split('T')[0];
  }

  private mapRow(row: any): IFiscalYear {
    return {
      fiscalYearId: String(row.fiscalYearId),
      code: row.code,
      startDate: this.formatDate(row.startDate) || '',
      endDate: this.formatDate(row.endDate) || '',
      status: row.status,
      oracleBudgetName: row.oracleBudgetName || null,
      isDelete: row.isDelete === 1 || row.isDelete === true,
      createdDate: this.formatDate(row.createdDate),
      createdBy: row.createdBy || null,
      modifiedDate: this.formatDate(row.modifiedDate),
      modifiedBy: row.modifiedBy || null,
      attr1: row.attr1 || null,
      attr2: row.attr2 || null,
      attr3: row.attr3 || null,
      attr4: row.attr4 || null,
      attr5: row.attr5 || null,
    };
  }

  async findAll(
    options?: IFiscalYearFilterOptions,
    qr?: QueryRunner,
  ): Promise<IFiscalYear[]> {
    const { search, includeInactive } = options || {};
    const params: any[] = [];
    let paramIndex = 0;

    let whereClause = includeInactive
      ? 'WHERE 1=1'
      : 'WHERE ISNULL([is_delete], 0) = 0';

    if (search) {
      whereClause += ` AND (LOWER([code]) LIKE LOWER(@${paramIndex}) OR LOWER([status]) LIKE LOWER(@${paramIndex}) OR LOWER([oracle_budget_name]) LIKE LOWER(@${paramIndex}))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const sql = `
      SELECT 
        [fiscal_year_id] AS fiscalYearId,
        [code] AS code,
        [start_date] AS startDate,
        [end_date] AS endDate,
        [status] AS status,
        [oracle_budget_name] AS oracleBudgetName,
        ISNULL([is_delete], 0) AS isDelete,
        [created_date] AS createdDate,
        [created_by] AS createdBy,
        [modified_date] AS modifiedDate,
        [modified_by] AS modifiedBy,
        [attr1] AS attr1,
        [attr2] AS attr2,
        [attr3] AS attr3,
        [attr4] AS attr4,
        [attr5] AS attr5
      FROM [masters].[tbl_Fiscal_Year]
      ${whereClause}
      ORDER BY [code] ASC;
    `;

    const rows = await this.getExecutor(qr).query(sql, params);
    return rows.map((r: any) => this.mapRow(r));
  }

  async findById(
    id: string,
    qr?: QueryRunner,
  ): Promise<IFiscalYear | null> {
    const sql = `
      SELECT 
        [fiscal_year_id] AS fiscalYearId,
        [code] AS code,
        [start_date] AS startDate,
        [end_date] AS endDate,
        [status] AS status,
        [oracle_budget_name] AS oracleBudgetName,
        ISNULL([is_delete], 0) AS isDelete,
        [created_date] AS createdDate,
        [created_by] AS createdBy,
        [modified_date] AS modifiedDate,
        [modified_by] AS modifiedBy,
        [attr1] AS attr1,
        [attr2] AS attr2,
        [attr3] AS attr3,
        [attr4] AS attr4,
        [attr5] AS attr5
      FROM [masters].[tbl_Fiscal_Year]
      WHERE [fiscal_year_id] = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [id]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  async findByCode(
    code: string,
    qr?: QueryRunner,
  ): Promise<IFiscalYear | null> {
    const sql = `
      SELECT 
        [fiscal_year_id] AS fiscalYearId,
        [code] AS code,
        [start_date] AS startDate,
        [end_date] AS endDate,
        [status] AS status,
        [oracle_budget_name] AS oracleBudgetName,
        ISNULL([is_delete], 0) AS isDelete,
        [created_date] AS createdDate,
        [created_by] AS createdBy,
        [modified_date] AS modifiedDate,
        [modified_by] AS modifiedBy,
        [attr1] AS attr1,
        [attr2] AS attr2,
        [attr3] AS attr3,
        [attr4] AS attr4,
        [attr5] AS attr5
      FROM [masters].[tbl_Fiscal_Year]
      WHERE LOWER([code]) = LOWER(@0);
    `;
    const rows = await this.getExecutor(qr).query(sql, [code]);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  async create(
    data: ICreateFiscalYearData,
    qr?: QueryRunner,
  ): Promise<IFiscalYear> {
    const fiscalYearId = data.fiscalYearId || uuidv4();
    const status = data.status || 'OPEN';
    const isDelete = data.isDelete !== undefined ? (data.isDelete ? 1 : 0) : 0;
    const createdBy = data.createdBy;
    // [modified_by] is NOT NULL in DB -> keep it empty on create
    const modifiedBy = data.modifiedBy || '';

    const sql = `
      INSERT INTO [masters].[tbl_Fiscal_Year] (
        [fiscal_year_id],
        [code],
        [start_date],
        [end_date],
        [status],
        [oracle_budget_name],
        [is_delete],
        [created_date],
        [created_by],
        [modified_date],
        [modified_by],
        [attr1],
        [attr2],
        [attr3],
        [attr4],
        [attr5]
      )
      VALUES (
        @0, @1, @2, @3, @4, @5, @6,
        CAST(SYSUTCDATETIME() AS DATE),
        @7,
        NULL,
        @8,
        @9, @10, @11, @12, @13
      );
    `;

    await this.getExecutor(qr).query(sql, [
      fiscalYearId,
      data.code,
      data.startDate,
      data.endDate,
      status,
      data.oracleBudgetName || null,
      isDelete,
      createdBy,
      modifiedBy,
      data.attr1 || null,
      data.attr2 || null,
      data.attr3 || null,
      data.attr4 || null,
      data.attr5 || null,
    ]);

    return (await this.findById(fiscalYearId, qr))!;
  }

  async update(
    id: string,
    data: IUpdateFiscalYearData,
    qr?: QueryRunner,
  ): Promise<IFiscalYear | null> {
    const fields: string[] = [];
    const params: any[] = [id];
    let paramIndex = 1;

    if (data.reactivate) {
      // Reactivating a soft-deleted record behaves like a fresh create:
      // reset created_date/created_by, clear modified_date/modified_by
      fields.push(`[created_date] = CAST(SYSUTCDATETIME() AS DATE)`);
      fields.push(`[created_by] = @${paramIndex++}`);
      params.push(data.createdBy);
      fields.push(`[modified_date] = NULL`);
      fields.push(`[modified_by] = ''`);
    } else {
      fields.push(`[modified_date] = CAST(SYSUTCDATETIME() AS DATE)`);
      if (data.modifiedBy) {
        fields.push(`[modified_by] = @${paramIndex++}`);
        params.push(data.modifiedBy);
      }
    }
    if (data.code !== undefined) {
      fields.push(`[code] = @${paramIndex++}`);
      params.push(data.code);
    }
    if (data.startDate !== undefined) {
      fields.push(`[start_date] = @${paramIndex++}`);
      params.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      fields.push(`[end_date] = @${paramIndex++}`);
      params.push(data.endDate);
    }
    if (data.status !== undefined) {
      fields.push(`[status] = @${paramIndex++}`);
      params.push(data.status);
    }
    if (data.oracleBudgetName !== undefined) {
      fields.push(`[oracle_budget_name] = @${paramIndex++}`);
      params.push(data.oracleBudgetName);
    }
    if (data.isDelete !== undefined) {
      fields.push(`[is_delete] = @${paramIndex++}`);
      params.push(data.isDelete ? 1 : 0);
    }
    if (data.attr1 !== undefined) {
      fields.push(`[attr1] = @${paramIndex++}`);
      params.push(data.attr1);
    }
    if (data.attr2 !== undefined) {
      fields.push(`[attr2] = @${paramIndex++}`);
      params.push(data.attr2);
    }
    if (data.attr3 !== undefined) {
      fields.push(`[attr3] = @${paramIndex++}`);
      params.push(data.attr3);
    }
    if (data.attr4 !== undefined) {
      fields.push(`[attr4] = @${paramIndex++}`);
      params.push(data.attr4);
    }
    if (data.attr5 !== undefined) {
      fields.push(`[attr5] = @${paramIndex++}`);
      params.push(data.attr5);
    }

    const sql = `
      UPDATE [masters].[tbl_Fiscal_Year]
      SET ${fields.join(', ')}
      WHERE [fiscal_year_id] = @0;
    `;
    await this.getExecutor(qr).query(sql, params);

    return this.findById(id, qr);
  }

  async softDelete(
    id: string,
    modifiedBy?: string,
    qr?: QueryRunner,
  ): Promise<boolean> {
    const sql = `
      UPDATE [masters].[tbl_Fiscal_Year]
      SET 
        [is_delete] = 1,
        [modified_date] = CAST(SYSUTCDATETIME() AS DATE),
        [modified_by] = ISNULL(@1, 'system')
      WHERE [fiscal_year_id] = @0;
    `;
    await this.getExecutor(qr).query(sql, [id, modifiedBy || null]);
    return true;
  }
}
