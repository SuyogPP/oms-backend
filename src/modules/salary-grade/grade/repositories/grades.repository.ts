import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

import {
  IGrade,
  IGradeFilterOptions,
} from '../interfaces/grade.interface';

@Injectable()
export class GradesRepository {
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
    gradeId: string,
    qr?: QueryRunner,
  ): Promise<IGrade | null> {
    const sql = `
      SELECT
        g.grade_id AS gradeId,
        g.grade_code AS gradeCode,
        g.grade_details AS gradeDetails,

        g.min_salary AS minSalary,
        g.max_salary AS maxSalary,

        g.attr1 AS attr1,
        g.attr2 AS attr2,
        g.attr3 AS attr3,
        g.attr4 AS attr4,
        g.attr5 AS attr5,

        g.is_active AS isActive,
        g.is_delete AS isDelete,

        g.created_by AS createdBy,
        CONVERT(VARCHAR(10), g.created_date, 23) AS createdDate,

        g.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), g.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Grades] g

      WHERE
        g.grade_id = @0
        AND g.is_delete = 0;
    `;

    const rows = await this.getExecutor(qr).query(
      sql,
      [gradeId],
    );

    return rows.length > 0
      ? (rows[0] as IGrade)
      : null;
  }

  // ============================================================
  // FIND BY CODE
  // Used to prevent duplicate grade codes
  // ============================================================

  async findByCode(
    gradeCode: string,
    qr?: QueryRunner,
  ): Promise<IGrade | null> {
    const sql = `
      SELECT
        g.grade_id AS gradeId,
        g.grade_code AS gradeCode,
        g.grade_details AS gradeDetails,

        g.min_salary AS minSalary,
        g.max_salary AS maxSalary,

        g.attr1 AS attr1,
        g.attr2 AS attr2,
        g.attr3 AS attr3,
        g.attr4 AS attr4,
        g.attr5 AS attr5,

        g.is_active AS isActive,
        g.is_delete AS isDelete,

        g.created_by AS createdBy,
        CONVERT(VARCHAR(10), g.created_date, 23) AS createdDate,

        g.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), g.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Grades] g

      WHERE
        LOWER(g.grade_code) = LOWER(@0)
        AND g.is_delete = 0;
    `;

    const rows = await this.getExecutor(qr).query(
      sql,
      [gradeCode],
    );

    return rows.length > 0
      ? (rows[0] as IGrade)
      : null;
  }

  // ============================================================
  // FIND ALL
  // Pagination + search + active filter
  // ============================================================

  async findAll(
    options: IGradeFilterOptions = {},
    qr?: QueryRunner,
  ): Promise<{
    rows: IGrade[];
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
      (safePage - 1) * safePageSize;

    const conditions: string[] = [
      'g.is_delete = 0',
    ];

    const params: Array<string | number> = [];

    let paramIndex = 0;

    if (isActive !== undefined) {
      conditions.push(
        `g.is_active = @${paramIndex}`,
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
          g.grade_code LIKE @${paramIndex}
          OR
          g.grade_details LIKE @${paramIndex}
        )
      `);

      params.push(
        `%${search.trim()}%`,
      );

      paramIndex++;
    }

    const where =
      conditions.join(' AND ');

    const countSql = `
      SELECT
        COUNT(*) AS total

      FROM [masters].[tbl_Grades] g

      WHERE ${where};
    `;

    const dataSql = `
      SELECT
        g.grade_id AS gradeId,
        g.grade_code AS gradeCode,
        g.grade_details AS gradeDetails,

        g.min_salary AS minSalary,
        g.max_salary AS maxSalary,

        g.attr1 AS attr1,
        g.attr2 AS attr2,
        g.attr3 AS attr3,
        g.attr4 AS attr4,
        g.attr5 AS attr5,

        g.is_active AS isActive,
        g.is_delete AS isDelete,

        g.created_by AS createdBy,
        CONVERT(VARCHAR(10), g.created_date, 23) AS createdDate,

        g.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), g.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Grades] g

      WHERE ${where}

      ORDER BY
        g.grade_code ASC

      OFFSET @${paramIndex} ROWS
      FETCH NEXT @${paramIndex + 1} ROWS ONLY;
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
      rows: rows as IGrade[],

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
      gradeCode: string;

      gradeDetails?:
        | string
        | null;

      minSalary?:
        | number
        | null;

      maxSalary?:
        | number
        | null;

      isActive:
        | string
        | null;

      createdBy: string;
    },
    qr?: QueryRunner,
  ): Promise<string> {
    const sql = `
      DECLARE @NewGrade TABLE
      (
        grade_id UNIQUEIDENTIFIER
      );

      INSERT INTO [masters].[tbl_Grades]
      (
        grade_id,
        grade_code,
        grade_details,

        min_salary,
        max_salary,

        is_active,
        is_delete,

        created_by,
        created_date,

        modified_by,
        modified_date
      )

      OUTPUT
        INSERTED.grade_id
        INTO @NewGrade

      VALUES
      (
        NEWID(),
        @0,
        @1,

        @2,
        @3,

        @4,
        0,

        @5,
        CAST(SYSUTCDATETIME() AS DATE),

        NULL,
        NULL
      );

      SELECT
        grade_id AS gradeId
      FROM @NewGrade;
    `;

    const result =
      await this.getExecutor(qr).query(
        sql,
        [
          data.gradeCode,
          data.gradeDetails ?? null,
          data.minSalary ?? null,
          data.maxSalary ?? null,
          data.isActive,
          data.createdBy,
        ],
      );

    return result[0].gradeId as string;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(
    gradeId: string,
    data: {
      gradeCode?: string;

      gradeDetails?:
        | string
        | null;

      minSalary?:
        | number
        | null;

      maxSalary?:
        | number
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
      string | number | null
    > = [
      data.modifiedBy,
    ];

    let paramIndex = 1;

    if (
      data.gradeCode !==
      undefined
    ) {
      setClauses.push(
        `grade_code = @${paramIndex}`,
      );

      params.push(
        data.gradeCode,
      );

      paramIndex++;
    }

    if (
      data.gradeDetails !==
      undefined
    ) {
      setClauses.push(
        `grade_details = @${paramIndex}`,
      );

      params.push(
        data.gradeDetails,
      );

      paramIndex++;
    }

    if (
      data.minSalary !==
      undefined
    ) {
      setClauses.push(
        `min_salary = @${paramIndex}`,
      );

      params.push(
        data.minSalary,
      );

      paramIndex++;
    }

    if (
      data.maxSalary !==
      undefined
    ) {
      setClauses.push(
        `max_salary = @${paramIndex}`,
      );

      params.push(
        data.maxSalary,
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
      gradeId,
    );

    const sql = `
      UPDATE [masters].[tbl_Grades]

      SET
        ${setClauses.join(
          ',\n        ',
        )}

      WHERE
        grade_id = @${paramIndex}
        AND is_delete = 0;
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
    gradeId: string,
    modifiedBy: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE [masters].[tbl_Grades]

      SET
        is_delete = 1,
        modified_by = @1,
        modified_date = CAST(SYSUTCDATETIME() AS DATE)

      WHERE
        grade_id = @0
        AND is_delete = 0;
    `;

    await this.getExecutor(qr).query(
      sql,
      [
        gradeId,
        modifiedBy,
      ],
    );
  }
}