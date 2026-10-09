import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  IDeploymentModel,
  IDeploymentModelFilterOptions,
} from '../interfaces/deployment-model.interface';

@Injectable()
export class DeploymentModelsRepository {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  // ============================================================
  // FIND BY ID
  // ============================================================

  async findById(
    deploymentId: string,
  ): Promise<IDeploymentModel | null> {
    const sql = `
      SELECT
        d.deployment_id AS deploymentId,
        d.deployment_code AS deploymentCode,
        d.deployment_name AS deploymentName,
        d.work_settings AS workSettings,

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

      FROM [masters].[tbl_Deployment_Model] d

      WHERE
        d.deployment_id = @0
        AND d.is_deleted = 0;
    `;

    const rows =
      await this.dataSource.query(
        sql,
        [deploymentId],
      );

    return rows.length > 0
      ? (rows[0] as IDeploymentModel)
      : null;
  }

  // ============================================================
  // FIND ALL
  // ============================================================

  async findAll(
    options: IDeploymentModelFilterOptions = {},
  ): Promise<IDeploymentModel[]> {
    const {
      search,
      isActive,
    } = options;

    const conditions: string[] = [
      'd.is_deleted = 0',
    ];

    const params: string[] = [];

    let paramIndex = 0;

    if (
      isActive !== undefined
    ) {
      conditions.push(
        `d.is_active = @${paramIndex}`,
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
          d.deployment_code LIKE @${paramIndex}
          OR
          d.deployment_name LIKE @${paramIndex}
          OR
          d.work_settings LIKE @${paramIndex}
        )
      `);

      params.push(
        `%${search.trim()}%`,
      );
    }

    const where =
      conditions.join(' AND ');

    const sql = `
      SELECT
        d.deployment_id AS deploymentId,
        d.deployment_code AS deploymentCode,
        d.deployment_name AS deploymentName,
        d.work_settings AS workSettings,

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

      FROM [masters].[tbl_Deployment_Model] d

      WHERE ${where}

      ORDER BY
        d.deployment_name ASC;
    `;

    const rows =
      await this.dataSource.query(
        sql,
        params,
      );

    return rows as IDeploymentModel[];
  }
}