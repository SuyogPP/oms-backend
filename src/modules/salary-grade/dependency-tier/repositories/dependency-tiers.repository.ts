import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

import {
  IDependencyTier,
  IDependencyTierFilterOptions,
} from '../interfaces/dependency-tier.interface';

@Injectable()
export class DependencyTiersRepository {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ?? this.dataSource;
  }

  // ============================================================
  // FIND BY ID
  // ============================================================

  async findById(
    tierId: string,
    qr?: QueryRunner,
  ): Promise<IDependencyTier | null> {
    const sql = `
      SELECT
        t.tier_id AS tierId,
        t.tier_code AS tierCode,
        t.description AS description,

        t.attr1 AS attr1,
        t.attr2 AS attr2,
        t.attr3 AS attr3,
        t.attr4 AS attr4,
        t.attr5 AS attr5,

        t.is_active AS isActive,
        t.is_deleted AS isDeleted,

        t.created_by AS createdBy,
        CONVERT(VARCHAR(10), t.created_date, 23) AS createdDate,

        t.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), t.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Dependency_Tier] t

      WHERE
        t.tier_id = @0
        AND t.is_deleted = 0;
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        [tierId],
      );

    return rows.length > 0
      ? (rows[0] as IDependencyTier)
      : null;
  }

  // ============================================================
  // FIND BY CODE
  // ============================================================

  async findByCode(
    tierCode: string,
    qr?: QueryRunner,
  ): Promise<IDependencyTier | null> {
    const sql = `
      SELECT
        t.tier_id AS tierId,
        t.tier_code AS tierCode,
        t.description AS description,

        t.attr1 AS attr1,
        t.attr2 AS attr2,
        t.attr3 AS attr3,
        t.attr4 AS attr4,
        t.attr5 AS attr5,

        t.is_active AS isActive,
        t.is_deleted AS isDeleted,

        t.created_by AS createdBy,
        CONVERT(VARCHAR(10), t.created_date, 23) AS createdDate,

        t.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), t.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Dependency_Tier] t

      WHERE
        LOWER(t.tier_code) = LOWER(@0)
        AND t.is_deleted = 0;
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        [tierCode],
      );

    return rows.length > 0
      ? (rows[0] as IDependencyTier)
      : null;
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  async findAll(
    options: IDependencyTierFilterOptions = {},
    qr?: QueryRunner,
  ): Promise<{
    rows: IDependencyTier[];
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
      't.is_deleted = 0',
    ];

    const params: Array<
      string | number
    > = [];

    let paramIndex = 0;

    if (
      isActive !== undefined
    ) {
      conditions.push(
        `t.is_active = @${paramIndex}`,
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
          t.tier_code LIKE @${paramIndex}
          OR
          t.description LIKE @${paramIndex}
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

      FROM [masters].[tbl_Dependency_Tier] t

      WHERE ${where};
    `;

    const dataSql = `
      SELECT
        t.tier_id AS tierId,
        t.tier_code AS tierCode,
        t.description AS description,

        t.attr1 AS attr1,
        t.attr2 AS attr2,
        t.attr3 AS attr3,
        t.attr4 AS attr4,
        t.attr5 AS attr5,

        t.is_active AS isActive,
        t.is_deleted AS isDeleted,

        t.created_by AS createdBy,
        CONVERT(VARCHAR(10), t.created_date, 23) AS createdDate,

        t.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), t.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Dependency_Tier] t

      WHERE ${where}

      ORDER BY
        t.tier_code ASC

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
      rows:
        rows as IDependencyTier[],

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
      tierCode: string;

      description?:
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
      DECLARE @NewTier TABLE
      (
        tier_id UNIQUEIDENTIFIER
      );

      INSERT INTO [masters].[tbl_Dependency_Tier]
      (
        tier_id,
        tier_code,
        description,

        is_active,
        is_deleted,

        created_by,
        created_date,

        modified_by,
        modified_date
      )

      OUTPUT
        INSERTED.tier_id
        INTO @NewTier

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
        tier_id AS tierId
      FROM @NewTier;
    `;

    const result =
      await this.getExecutor(qr).query(
        sql,
        [
          data.tierCode,
          data.description ?? null,
          data.isActive,
          data.createdBy,
        ],
      );

    return result[0]
      .tierId as string;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(
    tierId: string,
    data: {
      tierCode?: string;

      description?:
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
      data.tierCode !==
      undefined
    ) {
      setClauses.push(
        `tier_code = @${paramIndex}`,
      );

      params.push(
        data.tierCode,
      );

      paramIndex++;
    }

    if (
      data.description !==
      undefined
    ) {
      setClauses.push(
        `description = @${paramIndex}`,
      );

      params.push(
        data.description,
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
      tierId,
    );

    const sql = `
      UPDATE [masters].[tbl_Dependency_Tier]

      SET
        ${setClauses.join(
          ',\n        ',
        )}

      WHERE
        tier_id = @${paramIndex}
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
    tierId: string,
    modifiedBy: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE [masters].[tbl_Dependency_Tier]

      SET
        is_deleted = 1,
        modified_by = @1,
        modified_date = CAST(SYSUTCDATETIME() AS DATE)

      WHERE
        tier_id = @0
        AND is_deleted = 0;
    `;

    await this.getExecutor(qr).query(
      sql,
      [
        tierId,
        modifiedBy,
      ],
    );
  }
}