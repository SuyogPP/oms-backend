import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

import {
  IDesignation,
  IDesignationFilterOptions,
} from '../interfaces/designation.interface';

@Injectable()
export class DesignationsRepository {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Use QueryRunner when a transaction is supplied.
   * Otherwise use the standard DataSource.
   */
  private getExecutor(qr?: QueryRunner) {
    return qr ?? this.dataSource;
  }

  // ============================================================
  // FIND BY ID
  // ============================================================

  async findById(
    designationId: string,
    qr?: QueryRunner,
  ): Promise<IDesignation | null> {
    const sql = `
      SELECT
        d.designation_id AS designationId,
        d.designation_code AS designationCode,
        d.designation_name AS designationName,
        d.designation_summary AS designationSummary,

        d.attr1 AS attr1,
        d.attr2 AS attr2,
        d.attr3 AS attr3,
        d.attr4 AS attr4,
        d.attr5 AS attr5,

        d.is_active AS isActive,
        d.is_deleted AS isDeleted,

        d.created_by AS createdBy,
        CONVERT(VARCHAR(10), d.created_date, 23) AS createdDate,

        d.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), d.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Designation] d

      WHERE
        d.designation_id = @0
        AND d.is_deleted = 0;
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        [designationId],
      );

    return rows.length > 0
      ? (rows[0] as IDesignation)
      : null;
  }

  // ============================================================
  // FIND BY CODE
  // Used to prevent duplicate designation codes
  // ============================================================

  async findByCode(
    designationCode: string,
    qr?: QueryRunner,
  ): Promise<IDesignation | null> {
    const sql = `
      SELECT
        d.designation_id AS designationId,
        d.designation_code AS designationCode,
        d.designation_name AS designationName,
        d.designation_summary AS designationSummary,

        d.attr1 AS attr1,
        d.attr2 AS attr2,
        d.attr3 AS attr3,
        d.attr4 AS attr4,
        d.attr5 AS attr5,

        d.is_active AS isActive,
        d.is_deleted AS isDeleted,

        d.created_by AS createdBy,
        CONVERT(VARCHAR(10), d.created_date, 23) AS createdDate,

        d.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), d.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Designation] d

      WHERE
        LOWER(d.designation_code) = LOWER(@0)
        AND d.is_deleted = 0;
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        [designationCode],
      );

    return rows.length > 0
      ? (rows[0] as IDesignation)
      : null;
  }

  // ============================================================
  // FIND ALL
  // Pagination + search + active filter
  // ============================================================

  async findAll(
    options: IDesignationFilterOptions = {},
    qr?: QueryRunner,
  ): Promise<{
    rows: IDesignation[];
    total: number;
  }> {
    const {
      search,
      isActive,
      page = 1,
      pageSize = 20,
    } = options;

    const safePage =
      page > 0 ? page : 1;

    const safePageSize =
      pageSize > 0
        ? pageSize
        : 20;

    const offset =
      (safePage - 1) *
      safePageSize;

    const conditions: string[] = [
      'd.is_deleted = 0',
    ];

    const params: Array<
      string | number
    > = [];

    let paramIndex = 0;

    if (
      isActive !== undefined
    ) {
      conditions.push(
        `d.is_active = @${paramIndex}`,
      );

      params.push(isActive);

      paramIndex++;
    }

    if (
      search &&
      search.trim()
    ) {
      conditions.push(`
        (
          d.designation_code LIKE @${paramIndex}
          OR
          d.designation_name LIKE @${paramIndex}
          OR
          d.designation_summary LIKE @${paramIndex}
        )
      `);

      params.push(
        `%${search.trim()}%`,
      );

      paramIndex++;
    }

    const where =
      conditions.join(
        ' AND ',
      );

    const countSql = `
      SELECT
        COUNT(*) AS total

      FROM [masters].[tbl_Designation] d

      WHERE ${where};
    `;

    const dataSql = `
      SELECT
        d.designation_id AS designationId,
        d.designation_code AS designationCode,
        d.designation_name AS designationName,
        d.designation_summary AS designationSummary,

        d.attr1 AS attr1,
        d.attr2 AS attr2,
        d.attr3 AS attr3,
        d.attr4 AS attr4,
        d.attr5 AS attr5,

        d.is_active AS isActive,
        d.is_deleted AS isDeleted,

        d.created_by AS createdBy,
        CONVERT(VARCHAR(10), d.created_date, 23) AS createdDate,

        d.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), d.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Designation] d

      WHERE ${where}

      ORDER BY
        d.designation_code ASC

      OFFSET @${paramIndex} ROWS

      FETCH NEXT @${paramIndex + 1}
      ROWS ONLY;
    `;

    const executor =
      this.getExecutor(qr);

    const countResult =
      await executor.query(
        countSql,
        params,
      );

    const rows =
      await executor.query(
        dataSql,
        [
          ...params,
          offset,
          safePageSize,
        ],
      );

    return {
      rows:
        rows as IDesignation[],

      total: Number(
        countResult[0]?.total ?? 0,
      ),
    };
  }

  // ============================================================
  // CREATE
  // ============================================================

  async create(
    data: {
      designationCode: string;
      designationName: string;

      designationSummary?:
        | string
        | null;

      isActive:
        | string
        | null;

      createdBy: string;
    },
    qr?: QueryRunner,
  ): Promise<string> {
    const sql = `
      DECLARE @NewDesignation TABLE
      (
        designation_id UNIQUEIDENTIFIER
      );

      INSERT INTO [masters].[tbl_Designation]
      (
        designation_id,
        designation_code,
        designation_name,
        designation_summary,

        is_active,
        is_deleted,

        created_by,
        created_date,

        modified_by,
        modified_date
      )

      OUTPUT
        INSERTED.designation_id
        INTO @NewDesignation

      VALUES
      (
        NEWID(),
        @0,
        @1,
        @2,

        @3,
        0,

        @4,
        CAST(SYSUTCDATETIME() AS DATE),

        NULL,
        NULL
      );

      SELECT
        designation_id AS designationId
      FROM @NewDesignation;
    `;

    const result =
      await this.getExecutor(qr).query(
        sql,
        [
          data.designationCode,
          data.designationName,
          data.designationSummary ??
            null,
          data.isActive,
          data.createdBy,
        ],
      );

    return result[0]
      .designationId as string;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(
    designationId: string,
    data: {
      designationCode?: string;
      designationName?: string;

      designationSummary?:
        | string
        | null;

      isActive?:
        | string
        | null;

      modifiedBy: string;
    },
    qr?: QueryRunner,
  ): Promise<void> {
    const setClauses: string[] = [
      'modified_by = @0',
      'modified_date = CAST(SYSUTCDATETIME() AS DATE)',
    ];

    const params: Array<
      string | null
    > = [
      data.modifiedBy,
    ];

    let paramIndex = 1;

    if (
      data.designationCode !==
      undefined
    ) {
      setClauses.push(
        `designation_code = @${paramIndex}`,
      );

      params.push(
        data.designationCode,
      );

      paramIndex++;
    }

    if (
      data.designationName !==
      undefined
    ) {
      setClauses.push(
        `designation_name = @${paramIndex}`,
      );

      params.push(
        data.designationName,
      );

      paramIndex++;
    }

    if (
      data.designationSummary !==
      undefined
    ) {
      setClauses.push(
        `designation_summary = @${paramIndex}`,
      );

      params.push(
        data.designationSummary,
      );

      paramIndex++;
    }

    if (
      data.isActive !==
      undefined
    ) {
      setClauses.push(
        `is_active = @${paramIndex}`,
      );

      params.push(
        data.isActive,
      );

      paramIndex++;
    }

    params.push(
      designationId,
    );

    const sql = `
      UPDATE [masters].[tbl_Designation]

      SET
        ${setClauses.join(
          ',\n        ',
        )}

      WHERE
        designation_id = @${paramIndex}
        AND is_deleted = 0;
    `;

    await this.getExecutor(
      qr,
    ).query(
      sql,
      params,
    );
  }

  // ============================================================
  // SOFT DELETE
  // ============================================================

  async softDelete(
    designationId: string,
    modifiedBy: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE [masters].[tbl_Designation]

      SET
        is_deleted = 1,
        modified_by = @1,
        modified_date = CAST(SYSUTCDATETIME() AS DATE)

      WHERE
        designation_id = @0
        AND is_deleted = 0;
    `;

    await this.getExecutor(
      qr,
    ).query(
      sql,
      [
        designationId,
        modifiedBy,
      ],
    );
  }
}