import { Injectable } from '@nestjs/common';
import {
  DataSource,
  QueryRunner,
} from 'typeorm';

import {
  IGradeBenefit,
  IGradeBenefitCounts,
  IGradeBenefitFilterOptions,
} from '../interfaces/grade-benefit.interface';

@Injectable()
export class GradeBenefitsRepository {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  private getExecutor(
    qr?: QueryRunner,
  ) {
    return qr ?? this.dataSource;
  }

  private readonly baseSelect = `
    SELECT
      gb.salary_grade_id AS salaryGradeId,

      gb.deployment_id AS deploymentId,
      dm.deployment_code AS deploymentCode,
      dm.deployment_name AS deploymentName,

      gb.category_id AS categoryId,
      c.cat_code AS categoryCode,
      c.cat_details AS categoryDetails,

      gb.designation_id AS designationId,
      d.designation_code AS designationCode,
      d.designation_name AS designationName,
      d.designation_summary AS designationSummary,

      gb.grade_id AS gradeId,
      g.grade_code AS gradeCode,
      g.grade_details AS gradeDetails,
      g.min_salary AS minSalary,
      g.max_salary AS maxSalary,

      gb.tier_id AS tierId,
      dt.tier_code AS tierCode,
      dt.description AS tierDescription,

      gb.benefit_id AS benefitId,
      b.benefit_name AS benefitName,
      b.benefit_description AS benefitDescription,

      gb.office_setup AS officeSetup,

      gb.is_active AS isActive,
      gb.is_deleted AS isDeleted,

      gb.created_by AS createdBy,
      CONVERT(VARCHAR(10), gb.created_date, 23) AS createdDate,

      gb.modified_by AS modifiedBy,
      CONVERT(VARCHAR(10), gb.modified_date, 23) AS modifiedDate

    FROM [grade].[tbl_Grade_Benifit] gb

    INNER JOIN [masters].[tbl_Deployment_Model] dm
      ON dm.deployment_id = gb.deployment_id

    INNER JOIN [masters].[tbl_category] c
      ON c.category_id = gb.category_id

    INNER JOIN [masters].[tbl_Designation] d
      ON d.designation_id = gb.designation_id

    INNER JOIN [masters].[tbl_Grades] g
      ON g.grade_id = gb.grade_id

    INNER JOIN [masters].[tbl_Dependency_Tier] dt
      ON dt.tier_id = gb.tier_id

    INNER JOIN [masters].[tbl_Benefit] b
      ON b.benefit_id = gb.benefit_id
  `;

  // ============================================================
  // FIND BY ID
  // ============================================================

  async findById(
    salaryGradeId: string,
    qr?: QueryRunner,
  ): Promise<IGradeBenefit | null> {
    const sql = `
      ${this.baseSelect}

      WHERE
        gb.salary_grade_id = @0
        AND gb.is_deleted = 0;
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        [salaryGradeId],
      );

    return rows.length > 0
      ? (rows[0] as IGradeBenefit)
      : null;
  }

  // ============================================================
  // REFERENCE VALIDATION
  // ============================================================

  async validateReferences(
    data: {
      deploymentId: string;
      categoryId: string;
      designationId: string;
      gradeId: string;
      tierId: string;
      benefitId: string;
    },
    qr?: QueryRunner,
  ) {
    const sql = `
      SELECT
        CASE WHEN EXISTS (
          SELECT 1
          FROM [masters].[tbl_Deployment_Model]
          WHERE deployment_id = @0
            AND is_deleted = 0
        ) THEN 1 ELSE 0 END AS deploymentExists,

        CASE WHEN EXISTS (
          SELECT 1
          FROM [masters].[tbl_category]
          WHERE category_id = @1
            AND is_deleted = 0
        ) THEN 1 ELSE 0 END AS categoryExists,

        CASE WHEN EXISTS (
          SELECT 1
          FROM [masters].[tbl_Designation]
          WHERE designation_id = @2
            AND is_deleted = 0
        ) THEN 1 ELSE 0 END AS designationExists,

        CASE WHEN EXISTS (
          SELECT 1
          FROM [masters].[tbl_Grades]
          WHERE grade_id = @3
            AND is_delete = 0
        ) THEN 1 ELSE 0 END AS gradeExists,

        CASE WHEN EXISTS (
          SELECT 1
          FROM [masters].[tbl_Dependency_Tier]
          WHERE tier_id = @4
            AND is_deleted = 0
        ) THEN 1 ELSE 0 END AS tierExists,

        CASE WHEN EXISTS (
          SELECT 1
          FROM [masters].[tbl_Benefit]
          WHERE benefit_id = @5
            AND is_deleted = 0
        ) THEN 1 ELSE 0 END AS benefitExists;
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        [
          data.deploymentId,
          data.categoryId,
          data.designationId,
          data.gradeId,
          data.tierId,
          data.benefitId,
        ],
      );

    return rows[0];
  }

  // ============================================================
  // DUPLICATE CHECK
  // ============================================================

  async findDuplicate(
    data: {
      deploymentId: string;
      categoryId: string;
      designationId: string;
      gradeId: string;
      tierId: string;
      benefitId: string;
      officeSetup: boolean;
    },
    excludeId?: string,
    qr?: QueryRunner,
  ): Promise<string | null> {
    const params: Array<
      string | boolean
    > = [
      data.deploymentId,
      data.categoryId,
      data.designationId,
      data.gradeId,
      data.tierId,
      data.benefitId,
      data.officeSetup,
    ];

    let excludeClause = '';

    if (excludeId) {
      excludeClause = `
        AND salary_grade_id <> @7
      `;

      params.push(
        excludeId,
      );
    }

    const sql = `
      SELECT TOP 1
        salary_grade_id AS salaryGradeId

      FROM [grade].[tbl_Grade_Benifit]

      WHERE
        deployment_id = @0
        AND category_id = @1
        AND designation_id = @2
        AND grade_id = @3
        AND tier_id = @4
        AND benefit_id = @5
        AND office_setup = @6
        AND is_deleted = 0

        ${excludeClause};
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        params,
      );

    return rows.length > 0
      ? rows[0].salaryGradeId
      : null;
  }

  // ============================================================
  // COUNTS
  //
  // IMPORTANT:
  // Cards depend on deployment only.
  // They do NOT collapse when status filter is clicked.
  // ============================================================

  async getCounts(
    deploymentId?: string,
    qr?: QueryRunner,
  ): Promise<IGradeBenefitCounts> {
    const conditions = [
      'is_deleted = 0',
    ];

    const params: string[] = [];

    if (deploymentId) {
      conditions.push(
        'deployment_id = @0',
      );

      params.push(
        deploymentId,
      );
    }

    const where =
      conditions.join(' AND ');

    const sql = `
      SELECT
        COUNT(*) AS total,

        SUM(
          CASE
            WHEN LOWER(is_active) = 'true'
            THEN 1
            ELSE 0
          END
        ) AS active,

        SUM(
          CASE
            WHEN LOWER(is_active) = 'false'
            THEN 1
            ELSE 0
          END
        ) AS inactive

      FROM [grade].[tbl_Grade_Benifit]

      WHERE ${where};
    `;

    const rows =
      await this.getExecutor(qr).query(
        sql,
        params,
      );

    return {
      total: Number(
        rows[0]?.total ?? 0,
      ),

      active: Number(
        rows[0]?.active ?? 0,
      ),

      inactive: Number(
        rows[0]?.inactive ?? 0,
      ),
    };
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  async findAll(
    options: IGradeBenefitFilterOptions = {},
    qr?: QueryRunner,
  ): Promise<{
    rows: IGradeBenefit[];
    total: number;
  }> {
    const {
      deploymentId,
      isActive,
      search,
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
      'gb.is_deleted = 0',
    ];

    const params: Array<
      string | number
    > = [];

    let paramIndex = 0;

    if (deploymentId) {
      conditions.push(
        `gb.deployment_id = @${paramIndex}`,
      );

      params.push(
        deploymentId,
      );

      paramIndex++;
    }

    if (isActive !== undefined) {
      conditions.push(
        `gb.is_active = @${paramIndex}`,
      );

      params.push(
        isActive,
      );

      paramIndex++;
    }

    if (
      search &&
      search.trim()
    ) {
      conditions.push(`
        (
          dm.deployment_name LIKE @${paramIndex}
          OR
          c.cat_code LIKE @${paramIndex}
          OR
          c.cat_details LIKE @${paramIndex}
          OR
          d.designation_code LIKE @${paramIndex}
          OR
          d.designation_name LIKE @${paramIndex}
          OR
          g.grade_code LIKE @${paramIndex}
          OR
          g.grade_details LIKE @${paramIndex}
          OR
          dt.tier_code LIKE @${paramIndex}
          OR
          b.benefit_name LIKE @${paramIndex}
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

      FROM [grade].[tbl_Grade_Benifit] gb

      INNER JOIN [masters].[tbl_Deployment_Model] dm
        ON dm.deployment_id = gb.deployment_id

      INNER JOIN [masters].[tbl_category] c
        ON c.category_id = gb.category_id

      INNER JOIN [masters].[tbl_Designation] d
        ON d.designation_id = gb.designation_id

      INNER JOIN [masters].[tbl_Grades] g
        ON g.grade_id = gb.grade_id

      INNER JOIN [masters].[tbl_Dependency_Tier] dt
        ON dt.tier_id = gb.tier_id

      INNER JOIN [masters].[tbl_Benefit] b
        ON b.benefit_id = gb.benefit_id

      WHERE ${where};
    `;

    const dataSql = `
      ${this.baseSelect}

      WHERE ${where}

      ORDER BY
        dm.deployment_name,
        g.grade_code

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
        rows as IGradeBenefit[],

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
      deploymentId: string;
      categoryId: string;
      designationId: string;
      gradeId: string;
      tierId: string;
      benefitId: string;

      officeSetup: boolean;
      isActive: string;

      createdBy: string;
    },
    qr?: QueryRunner,
  ): Promise<string> {
    const sql = `
      DECLARE @NewRecord TABLE
      (
        salary_grade_id UNIQUEIDENTIFIER
      );

      INSERT INTO [grade].[tbl_Grade_Benifit]
      (
        salary_grade_id,

        deployment_id,
        category_id,
        designation_id,
        grade_id,
        tier_id,
        benefit_id,

        office_setup,

        is_active,
        is_deleted,

        created_by,
        created_date,

        modified_by,
        modified_date
      )

      OUTPUT
        INSERTED.salary_grade_id
        INTO @NewRecord

      VALUES
      (
        NEWID(),

        @0,
        @1,
        @2,
        @3,
        @4,
        @5,

        @6,

        @7,
        0,

        @8,
        CAST(SYSUTCDATETIME() AS DATE),

        NULL,
        NULL
      );

      SELECT
        salary_grade_id AS salaryGradeId
      FROM @NewRecord;
    `;

    const result =
      await this.getExecutor(qr).query(
        sql,
        [
          data.deploymentId,
          data.categoryId,
          data.designationId,
          data.gradeId,
          data.tierId,
          data.benefitId,
          data.officeSetup,
          data.isActive,
          data.createdBy,
        ],
      );

    return result[0]
      .salaryGradeId as string;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(
    salaryGradeId: string,
    data: {
      deploymentId?: string;
      categoryId?: string;
      designationId?: string;
      gradeId?: string;
      tierId?: string;
      benefitId?: string;

      officeSetup?: boolean;
      isActive?: string;

      modifiedBy: string;
    },
    qr?: QueryRunner,
  ): Promise<void> {
    const setClauses: string[] = [
      'modified_by = @0',
      'modified_date = CAST(SYSUTCDATETIME() AS DATE)',
    ];

    const params: Array<
      string | boolean
    > = [
      data.modifiedBy,
    ];

    let paramIndex = 1;

    const fields = [
      ['deployment_id', data.deploymentId],
      ['category_id', data.categoryId],
      ['designation_id', data.designationId],
      ['grade_id', data.gradeId],
      ['tier_id', data.tierId],
      ['benefit_id', data.benefitId],
    ] as const;

    for (
      const [column, value]
      of fields
    ) {
      if (
        value !== undefined
      ) {
        setClauses.push(
          `${column} = @${paramIndex}`,
        );

        params.push(
          value,
        );

        paramIndex++;
      }
    }

    if (
      data.officeSetup !==
      undefined
    ) {
      setClauses.push(
        `office_setup = @${paramIndex}`,
      );

      params.push(
        data.officeSetup,
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
      salaryGradeId,
    );

    const sql = `
      UPDATE [grade].[tbl_Grade_Benifit]

      SET
        ${setClauses.join(
          ',\n        ',
        )}

      WHERE
        salary_grade_id = @${paramIndex}
        AND is_deleted = 0;
    `;

    await this.getExecutor(qr).query(
      sql,
      params,
    );
  }

  // ============================================================
  // DELETE
  // ============================================================

  async softDelete(
    salaryGradeId: string,
    modifiedBy: string,
    qr?: QueryRunner,
  ): Promise<void> {
    const sql = `
      UPDATE [grade].[tbl_Grade_Benifit]

      SET
        is_deleted = 1,
        modified_by = @1,
        modified_date = CAST(SYSUTCDATETIME() AS DATE)

      WHERE
        salary_grade_id = @0
        AND is_deleted = 0;
    `;

    await this.getExecutor(qr).query(
      sql,
      [
        salaryGradeId,
        modifiedBy,
      ],
    );
  }
}