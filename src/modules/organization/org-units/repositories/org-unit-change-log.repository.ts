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
   * @returns The generated OrgUnitChangeLogId
   */
  async create(
    data: {
      orgUnitId: string;
      changeType: string;
      oldParentOrgUnitId?: string | null;
      newParentOrgUnitId?: string | null;
      oldValues?: any;
      newValues?: any;
      affectedNodeCount?: number | null;
      reason?: string | null;
      correlationId?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
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
      INSERT INTO org.OrgUnitChangeLog (
        OrgUnitId,
        ChangeType,
        OldParentOrgUnitId,
        NewParentOrgUnitId,
        OldValues,
        NewValues,
        AffectedNodeCount,
        Reason,
        CorrelationId,
        IPAddress,
        UserAgent,
        PerformedBy,
        PerformedAt
      )
      OUTPUT INSERTED.OrgUnitChangeLogId AS logId
      VALUES (
        @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, SYSUTCDATETIME()
      );
    `;

    const params = [
      data.orgUnitId,
      data.changeType,
      data.oldParentOrgUnitId ?? null,
      data.newParentOrgUnitId ?? null,
      oldValuesJson,
      newValuesJson,
      data.affectedNodeCount ?? null,
      data.reason ?? null,
      data.correlationId ?? null,
      data.ipAddress ?? null,
      data.userAgent ?? null,
      data.performedBy ?? null,
    ];

    const result = await this.getExecutor(qr).query(sql, params);
    return result[0]?.logId;
  }

  /**
   * Retrieves paginated change log history for a specific organization unit.
   */
  async findByOrgUnitId(
    orgUnitId: string,
    page = 1,
    pageSize = 20,
    qr?: QueryRunner,
  ): Promise<[IOrgUnitChangeLog[], number]> {
    const offset = Math.max(0, (page - 1) * pageSize);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM org.OrgUnitChangeLog
      WHERE OrgUnitId = @0;
    `;
    const countRes = await this.getExecutor(qr).query(countSql, [orgUnitId]);
    const total = Number(countRes[0]?.total || 0);

    const dataSql = `
      SELECT
        OrgUnitChangeLogId AS orgUnitChangeLogId,
        OrgUnitId AS orgUnitId,
        ChangeType AS changeType,
        OldParentOrgUnitId AS oldParentOrgUnitId,
        NewParentOrgUnitId AS newParentOrgUnitId,
        OldValues AS oldValues,
        NewValues AS newValues,
        AffectedNodeCount AS affectedNodeCount,
        Reason AS reason,
        CorrelationId AS correlationId,
        IPAddress AS ipAddress,
        UserAgent AS userAgent,
        PerformedBy AS performedBy,
        PerformedAt AS performedAt
      FROM org.OrgUnitChangeLog
      WHERE OrgUnitId = @0
      ORDER BY PerformedAt DESC, OrgUnitChangeLogId DESC
      OFFSET @1 ROWS FETCH NEXT @2 ROWS ONLY;
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
      FROM org.OrgUnitChangeLog;
    `;
    const countRes = await this.getExecutor(qr).query(countSql);
    const total = Number(countRes[0]?.total || 0);

    const dataSql = `
      SELECT
        OrgUnitChangeLogId AS orgUnitChangeLogId,
        OrgUnitId AS orgUnitId,
        ChangeType AS changeType,
        OldParentOrgUnitId AS oldParentOrgUnitId,
        NewParentOrgUnitId AS newParentOrgUnitId,
        OldValues AS oldValues,
        NewValues AS newValues,
        AffectedNodeCount AS affectedNodeCount,
        Reason AS reason,
        CorrelationId AS correlationId,
        IPAddress AS ipAddress,
        UserAgent AS userAgent,
        PerformedBy AS performedBy,
        PerformedAt AS performedAt
      FROM org.OrgUnitChangeLog
      ORDER BY PerformedAt DESC, OrgUnitChangeLogId DESC
      OFFSET @0 ROWS FETCH NEXT @1 ROWS ONLY;
    `;

    const rows = await this.getExecutor(qr).query(dataSql, [offset, pageSize]);
    return [rows, total];
  }
}
