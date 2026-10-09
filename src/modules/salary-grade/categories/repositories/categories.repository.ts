import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

import {
  ICategory,
  ICategoryFilterOptions,
} from '../interfaces/category.interface';

@Injectable()
export class CategoriesRepository {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Use the QueryRunner when a transaction is supplied.
   * Otherwise, use the normal DataSource.
   */
  private getExecutor(qr?: QueryRunner) {
    return qr ?? this.dataSource;
  }

  // ============================================================
  // FIND BY ID
  // ============================================================

  async findById(
    categoryId: string,
    qr?: QueryRunner,
  ): Promise<ICategory | null> {
    const sql = `
      SELECT
        c.category_id AS categoryId,
        c.cat_code AS categoryCode,
        c.cat_details AS categoryDetails,

        c.attr1 AS attr1,
        c.attr2 AS attr2,
        c.attr3 AS attr3,
        c.attr4 AS attr4,
        c.attr5 AS attr5,

        c.is_active AS isActive,
        c.is_deleted AS isDeleted,

        c.created_by AS createdBy,
        CONVERT(VARCHAR(10), c.created_date, 23) AS createdDate,

        c.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), c.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Grade_Category] c

      WHERE
        c.category_id = @0
        AND c.is_deleted = 0;
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        [categoryId],
      );

    return rows.length > 0
      ? (rows[0] as ICategory)
      : null;
  }

  // ============================================================
  // FIND BY CATEGORY CODE
  // Used later to check for duplicate category codes.
  // ============================================================

  async findByCode(
    categoryCode: string,
    qr?: QueryRunner,
  ): Promise<ICategory | null> {
    const sql = `
      SELECT
        c.category_id AS categoryId,
        c.cat_code AS categoryCode,
        c.cat_details AS categoryDetails,

        c.attr1 AS attr1,
        c.attr2 AS attr2,
        c.attr3 AS attr3,
        c.attr4 AS attr4,
        c.attr5 AS attr5,

        c.is_active AS isActive,
        c.is_deleted AS isDeleted,

        c.created_by AS createdBy,
        CONVERT(VARCHAR(10), c.created_date, 23) AS createdDate,

        c.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), c.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Grade_Category] c

      WHERE
        LOWER(c.cat_code) = LOWER(@0)
        AND c.is_deleted = 0;
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        [categoryCode],
      );

    return rows.length > 0
      ? (rows[0] as ICategory)
      : null;
  }

  // ============================================================
  // FIND ALL
  // Pagination + search + active filter
  // ============================================================

  async findAll(
    options: ICategoryFilterOptions = {},
    qr?: QueryRunner,
  ): Promise<{
    rows: ICategory[];
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
      'c.is_deleted = 0',
    ];

    const params: Array<
      string | number
    > = [];

    let paramIndex = 0;

    if (
      isActive !== undefined
    ) {
      conditions.push(
        `c.is_active = @${paramIndex}`,
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
          c.cat_code LIKE @${paramIndex}
          OR
          c.cat_details LIKE @${paramIndex}
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

      FROM [masters].[tbl_Grade_Category] c

      WHERE ${where};
    `;

    const dataSql = `
      SELECT
        c.category_id AS categoryId,
        c.cat_code AS categoryCode,
        c.cat_details AS categoryDetails,

        c.attr1 AS attr1,
        c.attr2 AS attr2,
        c.attr3 AS attr3,
        c.attr4 AS attr4,
        c.attr5 AS attr5,

        c.is_active AS isActive,
        c.is_deleted AS isDeleted,

        c.created_by AS createdBy,
        CONVERT(VARCHAR(10), c.created_date, 23) AS createdDate,

        c.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), c.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Grade_Category] c

      WHERE ${where}

      ORDER BY
        c.cat_code ASC

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
        rows as ICategory[],

      total: Number(
        countResult[0]
          ?.total ?? 0,
      ),
    };
  }

  // ============================================================
  // CREATE
  // ============================================================

  async create(
    data: {
      categoryCode: string;

      categoryDetails?:
        | string
        | null;

      /**
       * Raw DB value because the existing
       * database column is NVARCHAR(10).
       *
       * We will convert the API boolean
       * to the correct DB value in the
       * service after checking the
       * existing DB convention.
       */
      isActive:
        | string
        | null;

      createdBy: string;
    },
    qr?: QueryRunner,
  ): Promise<string> {
    const sql = `
      DECLARE @NewCategory TABLE
      (
        category_id UNIQUEIDENTIFIER
      );

      INSERT INTO [masters].[tbl_Grade_Category]
      (
        category_id,
        cat_code,
        cat_details,

        is_active,
        is_deleted,

        created_by,
        created_date,

        modified_by,
        modified_date
      )

      OUTPUT
        INSERTED.category_id
        INTO @NewCategory

      VALUES
      (
        NEWID(),
        @0,
        @1,

        @2,
        0,

        @3,
        CAST(SYSUTCDATETIME() AS DATE),

        NULL,
        NULL
      );

      SELECT
        category_id AS categoryId
      FROM @NewCategory;
    `;

    const result =
      await this.getExecutor(qr).query(
        sql,
        [
          data.categoryCode,
          data.categoryDetails ??
            null,
          data.isActive,
          data.createdBy,
        ],
      );

    return result[0]
      .categoryId as string;
  }

  // ============================================================
  // UPDATE
  // Only updates fields actually supplied.
  // ============================================================

  async update(
    categoryId: string,
    data: {
      categoryCode?: string;

      categoryDetails?:
        | string
        | null;

      isActive?:
        | string
        | null;

      modifiedBy: string;
    },
    qr?: QueryRunner,
  ): Promise<void> {
    const setClauses: string[] =
      [
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
      data.categoryCode !==
      undefined
    ) {
      setClauses.push(
        `cat_code = @${paramIndex}`,
      );

      params.push(
        data.categoryCode,
      );

      paramIndex++;
    }

    if (
      data.categoryDetails !==
      undefined
    ) {
      setClauses.push(
        `cat_details = @${paramIndex}`,
      );

      params.push(
        data.categoryDetails,
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
      categoryId,
    );

    const sql = `
      UPDATE [masters].[tbl_Grade_Category]

      SET
        ${setClauses.join(
          ',\n        ',
        )}

      WHERE
        category_id = @${paramIndex}
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
  // We do NOT physically delete the database row.
  // ============================================================

  async softDelete(
    categoryId: string,
    modifiedBy: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE [masters].[tbl_Grade_Category]

      SET
        is_deleted = 1,
        modified_by = @1,
        modified_date = CAST(SYSUTCDATETIME() AS DATE)

      WHERE
        category_id = @0
        AND is_deleted = 0;
    `;

    await this.getExecutor(
      qr,
    ).query(
      sql,
      [
        categoryId,
        modifiedBy,
      ],
    );
  }
}