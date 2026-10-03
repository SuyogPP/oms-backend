import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IOrgUnitChangeLog } from '../interfaces/org-unit.interface';

@Injectable()
export class OrgUnitChangeLogRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Records a structural organization unit change event.
   *
   * @param data The change log record to insert
   * @param qr Optional QueryRunner for transactional atomicity
   * @returns The generated org_unit_change_log_id
   */
  async create(
    data: {
      orgUnitId: number;
      changeType: string;
      oldParentId?: number | null;
      newParentId?: number | null;
      oldValues?: any;
      newValues?: any;
      reason?: string | null;
      performedBy?: string | null;
    },
    qr?: QueryRunner,
  ): Promise<number> {
    const oldValuesJson =
      data.oldValues !== undefined && data.oldValues !== null
        ? typeof data.oldValues === 'string'
          ? data.oldValues
          : JSON.stringify(data.oldValues)
        : null;

    const newValuesJson =
      data.newValues !== undefined && data.newValues !== null
        ? typeof data.newValues === 'string'
          ? data.newValues
          : JSON.stringify(data.newValues)
        : null;

    const sql = `
      INSERT INTO auth.org_unit_change_log (
        org_unit_id,
        change_type,
        old_parent_id,
        new_parent_id,
        old_values,
        new_values,
        reason,
        performed_by,
        performed_at
      )
      OUTPUT INSERTED.org_unit_change_log_id AS logId
      VALUES (
        @0, @1, @2, @3, @4, @5, @6, @7, SYSUTCDATETIME()
      );
    `;

    const params = [
      data.orgUnitId,
      data.changeType,
      data.oldParentId ?? null,
      data.newParentId ?? null,
      oldValuesJson,
      newValuesJson,
      data.reason ?? null,
      data.performedBy ?? null,
    ];

    const result = await this.getExecutor(qr).query(sql, params);
    return result[0]?.logId;
  }

  /**
   * Retrieves paginated change log history for a specific organization unit.
   */
  async findByOrgUnitId(
    orgUnitId: number,
    page = 1,
    pageSize = 20,
    qr?: QueryRunner,
  ): Promise<[IOrgUnitChangeLog[], number]> {
    const offset = Math.max(0, (page - 1) * pageSize);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM auth.org_unit_change_log
      WHERE org_unit_id = @0;
    `;
    const countRes = await this.getExecutor(qr).query(countSql, [orgUnitId]);
    const total = Number(countRes[0]?.total || 0);

    const dataSql = `
      WITH NumberedRows AS (
        SELECT
          org_unit_change_log_id AS orgUnitChangeLogId,
          org_unit_id AS orgUnitId,
          change_type AS changeType,
          old_parent_id AS oldParentId,
          new_parent_id AS newParentId,
          old_values AS oldValues,
          new_values AS newValues,
          reason AS reason,
          performed_by AS performedBy,
          performed_at AS performedAt,
          ROW_NUMBER() OVER (ORDER BY performed_at DESC, org_unit_change_log_id DESC) AS RowNum
        FROM auth.org_unit_change_log
        WHERE org_unit_id = @0
      )
      SELECT
        orgUnitChangeLogId,
        orgUnitId,
        changeType,
        oldParentId,
        newParentId,
        oldValues,
        newValues,
        reason,
        performedBy,
        performedAt
      FROM NumberedRows
      WHERE RowNum > @1 AND RowNum <= (@1 + @2)
      ORDER BY RowNum;
    `;

    const rows = await this.getExecutor(qr).query(dataSql, [
      orgUnitId,
      offset,
      pageSize,
    ]);

    return [rows, total];
  }

  /**
   * Retrieves paginated change log history across all organization units.
   */
  async findAll(
    page = 1,
    pageSize = 20,
    qr?: QueryRunner,
  ): Promise<[IOrgUnitChangeLog[], number]> {
    const offset = Math.max(0, (page - 1) * pageSize);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM auth.org_unit_change_log;
    `;
    const countRes = await this.getExecutor(qr).query(countSql);
    const total = Number(countRes[0]?.total || 0);

    const dataSql = `
      WITH NumberedRows AS (
        SELECT
          org_unit_change_log_id AS orgUnitChangeLogId,
          org_unit_id AS orgUnitId,
          change_type AS changeType,
          old_parent_id AS oldParentId,
          new_parent_id AS newParentId,
          old_values AS oldValues,
          new_values AS newValues,
          reason AS reason,
          performed_by AS performedBy,
          performed_at AS performedAt,
          ROW_NUMBER() OVER (ORDER BY performed_at DESC, org_unit_change_log_id DESC) AS RowNum
        FROM auth.org_unit_change_log
      )
      SELECT
        orgUnitChangeLogId,
        orgUnitId,
        changeType,
        oldParentId,
        newParentId,
        oldValues,
        newValues,
        reason,
        performedBy,
        performedAt
      FROM NumberedRows
      WHERE RowNum > @0 AND RowNum <= (@0 + @1)
      ORDER BY RowNum;
    `;

    const rows = await this.getExecutor(qr).query(dataSql, [offset, pageSize]);
    return [rows, total];
  }
}
