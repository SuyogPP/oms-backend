import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

import {
  IBenefit,
  IBenefitFilterOptions,
} from 'src/modules/salary-grade/benefit/interfaces/benefit.interface';

@Injectable()
export class BenefitsRepository {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ?? this.dataSource;
  }

  async findById(
    benefitId: string,
    qr?: QueryRunner,
  ): Promise<IBenefit | null> {
    const sql = `
      SELECT
        b.benefit_id AS benefitId,
        b.benefit_name AS benefitName,
        b.benefit_description AS benefitDescription,

        b.attr1 AS attr1,
        b.attr2 AS attr2,
        b.attr3 AS attr3,
        b.attr4 AS attr4,
        b.attr5 AS attr5,

        b.is_active AS isActive,
        b.is_deleted AS isDeleted,

        b.created_by AS createdBy,
        CONVERT(VARCHAR(10), b.created_date, 23) AS createdDate,

        b.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), b.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Benefit] b

      WHERE
        b.benefit_id = @0
        AND b.is_deleted = 0;
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        [benefitId],
      );

    return rows.length > 0
      ? (rows[0] as IBenefit)
      : null;
  }

  async findByName(
    benefitName: string,
    qr?: QueryRunner,
  ): Promise<IBenefit | null> {
    const sql = `
      SELECT
        b.benefit_id AS benefitId,
        b.benefit_name AS benefitName,
        b.benefit_description AS benefitDescription,

        b.attr1 AS attr1,
        b.attr2 AS attr2,
        b.attr3 AS attr3,
        b.attr4 AS attr4,
        b.attr5 AS attr5,

        b.is_active AS isActive,
        b.is_deleted AS isDeleted,

        b.created_by AS createdBy,
        CONVERT(VARCHAR(10), b.created_date, 23) AS createdDate,

        b.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), b.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Benefit] b

      WHERE
        LOWER(b.benefit_name) = LOWER(@0)
        AND b.is_deleted = 0;
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        [benefitName],
      );

    return rows.length > 0
      ? (rows[0] as IBenefit)
      : null;
  }

  async findAll(
    options: IBenefitFilterOptions = {},
    qr?: QueryRunner,
  ): Promise<{
    rows: IBenefit[];
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
      'b.is_deleted = 0',
    ];

    const params: Array<string | number> = [];

    let paramIndex = 0;

    if (isActive !== undefined) {
      conditions.push(
        `b.is_active = @${paramIndex}`,
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
          b.benefit_name LIKE @${paramIndex}
          OR
          b.benefit_description LIKE @${paramIndex}
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

      FROM [masters].[tbl_Benefit] b

      WHERE ${where};
    `;

    const dataSql = `
      SELECT
        b.benefit_id AS benefitId,
        b.benefit_name AS benefitName,
        b.benefit_description AS benefitDescription,

        b.attr1 AS attr1,
        b.attr2 AS attr2,
        b.attr3 AS attr3,
        b.attr4 AS attr4,
        b.attr5 AS attr5,

        b.is_active AS isActive,
        b.is_deleted AS isDeleted,

        b.created_by AS createdBy,
        CONVERT(VARCHAR(10), b.created_date, 23) AS createdDate,

        b.modified_by AS modifiedBy,
        CONVERT(VARCHAR(10), b.modified_date, 23) AS modifiedDate

      FROM [masters].[tbl_Benefit] b

      WHERE ${where}

      ORDER BY
        b.benefit_name ASC

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
      rows: rows as IBenefit[],

      total: Number(
        countResult[0]?.total ?? 0,
      ),
    };
  }

  async create(
    data: {
      benefitName: string;

      benefitDescription?:
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
      DECLARE @NewBenefit TABLE
      (
        benefit_id UNIQUEIDENTIFIER
      );

      INSERT INTO [masters].[tbl_Benefit]
      (
        benefit_id,
        benefit_name,
        benefit_description,

        is_active,
        is_deleted,

        created_by,
        created_date,

        modified_by,
        modified_date
      )

      OUTPUT
        INSERTED.benefit_id
        INTO @NewBenefit

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
        benefit_id AS benefitId
      FROM @NewBenefit;
    `;

    const result =
      await this.getExecutor(qr).query(
        sql,
        [
          data.benefitName,
          data.benefitDescription ?? null,
          data.isActive,
          data.createdBy,
        ],
      );

    return result[0]
      .benefitId as string;
  }

  async update(
    benefitId: string,
    data: {
      benefitName?: string;

      benefitDescription?:
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

    const params: Array<string | null> = [
      data.modifiedBy,
    ];

    let paramIndex = 1;

    if (
      data.benefitName !== undefined
    ) {
      setClauses.push(
        `benefit_name = @${paramIndex}`,
      );

      params.push(
        data.benefitName,
      );

      paramIndex++;
    }

    if (
      data.benefitDescription !== undefined
    ) {
      setClauses.push(
        `benefit_description = @${paramIndex}`,
      );

      params.push(
        data.benefitDescription,
      );

      paramIndex++;
    }

    if (
      data.isActive !== undefined
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
      benefitId,
    );

    const sql = `
      UPDATE [masters].[tbl_Benefit]

      SET
        ${setClauses.join(
          ',\n        ',
        )}

      WHERE
        benefit_id = @${paramIndex}
        AND is_deleted = 0;
    `;

    await this.getExecutor(qr).query(
      sql,
      params,
    );
  }

  async softDelete(
    benefitId: string,
    modifiedBy: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE [masters].[tbl_Benefit]

      SET
        is_deleted = 1,
        modified_by = @1,
        modified_date = CAST(SYSUTCDATETIME() AS DATE)

      WHERE
        benefit_id = @0
        AND is_deleted = 0;
    `;

    await this.getExecutor(qr).query(
      sql,
      [
        benefitId,
        modifiedBy,
      ],
    );
  }
}