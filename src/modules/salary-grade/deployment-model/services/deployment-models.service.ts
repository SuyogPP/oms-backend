import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

import {
  DEPLOYMENT_MODEL_ERROR_CODES,
} from '../deployment-model.constants';

import {
  DeploymentModelEntity,
} from '../entities/deployment-model.entity';

import {
  IDeploymentModel,
} from '../interfaces/deployment-model.interface';

import {
  DeploymentModelsRepository,
} from '../repositories/deployment-models.repository';

@Injectable()
export class DeploymentModelsService {
  constructor(
    private readonly deploymentModelsRepository: DeploymentModelsRepository,
  ) {}

  // ============================================================
  // HELPERS
  // ============================================================

  private toBoolean(
    value: string | null,
  ): boolean {
    if (!value) {
      return false;
    }

    return value.toLowerCase() === 'true';
  }

  private toEntity(
    row: IDeploymentModel,
  ): DeploymentModelEntity {
    return {
      deploymentId:
        row.deploymentId,

      deploymentCode:
        row.deploymentCode,

      deploymentName:
        row.deploymentName,

      workSettings:
        row.workSettings,

      isActive:
        this.toBoolean(
          row.isActive,
        ),

      isDeleted:
        row.isDeleted,

      createdBy:
        row.createdBy,

      createdDate:
        row.createdDate,

      modifiedBy:
        row.modifiedBy,

      modifiedDate:
        row.modifiedDate,
    };
  }

  // ============================================================
  // GET ALL
  // ============================================================

  async findAll(
    options: {
      search?: string;
      isActive?: boolean;
    } = {},
  ): Promise<DeploymentModelEntity[]> {
    const rows =
      await this.deploymentModelsRepository.findAll(
        {
          search:
            options.search?.trim(),

          isActive:
            options.isActive !== undefined
              ? options.isActive
                ? 'True'
                : 'False'
              : undefined,
        },
      );

    return rows.map(
      (row) =>
        this.toEntity(row),
    );
  }

  // ============================================================
  // GET BY ID
  // ============================================================

  async findById(
    deploymentId: string,
  ): Promise<DeploymentModelEntity> {
    const row =
      await this.deploymentModelsRepository.findById(
        deploymentId,
      );

    if (!row) {
      throw new HttpException(
        {
          code:
            DEPLOYMENT_MODEL_ERROR_CODES.DEPLOYMENT_MODEL_NOT_FOUND,

          message:
            `Deployment Model [${deploymentId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toEntity(
      row,
    );
  }
}