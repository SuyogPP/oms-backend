import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

import {
  DataSource,
  QueryRunner,
} from 'typeorm';

import type {
  CurrentUser as ICurrentUser,
} from '../../../auth/interfaces/current-user.interface';

import {
  CreateDependencyTierDto,
} from '../dto/create-dependency-tier.dto';

import {
  UpdateDependencyTierDto,
} from '../dto/update-dependency-tier.dto';

import {
  DependencyTierEntity,
} from '../entities/dependency-tier.entity';

import {
  IDependencyTier,
} from '../interfaces/dependency-tier.interface';

import {
  DEPENDENCY_TIER_ERROR_CODES,
} from '../dependency-tier.constants';

import {
  DependencyTiersRepository,
} from '../repositories/dependency-tiers.repository';

@Injectable()
export class DependencyTiersService {
  constructor(
    private readonly dependencyTiersRepository: DependencyTiersRepository,
    private readonly dataSource: DataSource,
  ) {}

  private toBoolean(
    value: string | null,
  ): boolean {
    if (!value) {
      return false;
    }

    return value.toLowerCase() === 'true';
  }

  private toDbActive(
    value: boolean,
  ): string {
    return value
      ? 'True'
      : 'False';
  }

  private toEntity(
    row: IDependencyTier,
  ): DependencyTierEntity {
    return {
      tierId:
        row.tierId,

      tierCode:
        row.tierCode,

      description:
        row.description,

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
  // GET BY ID
  // ============================================================

  async findById(
    tierId: string,
  ): Promise<DependencyTierEntity> {
    const row =
      await this.dependencyTiersRepository.findById(
        tierId,
      );

    if (!row) {
      throw new HttpException(
        {
          code:
            DEPENDENCY_TIER_ERROR_CODES.DEPENDENCY_TIER_NOT_FOUND,

          message:
            `Dependency Tier [${tierId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toEntity(
      row,
    );
  }

  // ============================================================
  // GET ALL
  // ============================================================

  async findAll(
    options: {
      search?: string;
      isActive?: boolean;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const {
      rows,
      total,
    } =
      await this.dependencyTiersRepository.findAll(
        {
          search:
            options.search?.trim(),

          isActive:
            options.isActive !== undefined
              ? this.toDbActive(
                  options.isActive,
                )
              : undefined,

          page:
            options.page ?? 1,

          pageSize:
            options.pageSize ?? 20,
        },
      );

    return {
      data:
        rows.map(
          (row) =>
            this.toEntity(row),
        ),

      total,

      page:
        options.page ?? 1,

      pageSize:
        options.pageSize ?? 20,
    };
  }

  // ============================================================
  // CREATE
  // ============================================================

  async create(
    dto: CreateDependencyTierDto,
    user: ICurrentUser,
  ): Promise<DependencyTierEntity> {
    const tierCode =
      dto.tierCode.trim();

    const existing =
      await this.dependencyTiersRepository.findByCode(
        tierCode,
      );

    if (existing) {
      throw new HttpException(
        {
          code:
            DEPENDENCY_TIER_ERROR_CODES.DEPENDENCY_TIER_CODE_DUPLICATE,

          message:
            `A dependency tier with code [${tierCode}] already exists.`,
        },
        HttpStatus.CONFLICT,
      );
    }

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();
    await qr.startTransaction();

    let newId: string;

    try {
      newId =
        await this.dependencyTiersRepository.create(
          {
            tierCode,

            description:
              dto.description !== undefined
                ? dto.description?.trim() ||
                  null
                : null,

            isActive:
              this.toDbActive(
                dto.isActive ?? true,
              ),

            createdBy:
              user.userId,
          },
          qr,
        );

      await qr.commitTransaction();
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }

      throw error;
    } finally {
      await qr.release();
    }

    return this.findById(
      newId,
    );
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(
    tierId: string,
    dto: UpdateDependencyTierDto,
    user: ICurrentUser,
  ): Promise<DependencyTierEntity> {
    const existing =
      await this.dependencyTiersRepository.findById(
        tierId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            DEPENDENCY_TIER_ERROR_CODES.DEPENDENCY_TIER_NOT_FOUND,

          message:
            `Dependency Tier [${tierId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      dto.tierCode !== undefined
    ) {
      const newCode =
        dto.tierCode.trim();

      if (
        newCode.toLowerCase() !==
        existing.tierCode.toLowerCase()
      ) {
        const duplicate =
          await this.dependencyTiersRepository.findByCode(
            newCode,
          );

        if (
          duplicate &&
          duplicate.tierId !== tierId
        ) {
          throw new HttpException(
            {
              code:
                DEPENDENCY_TIER_ERROR_CODES.DEPENDENCY_TIER_CODE_DUPLICATE,

              message:
                `A dependency tier with code [${newCode}] already exists.`,
            },
            HttpStatus.CONFLICT,
          );
        }
      }
    }

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();
    await qr.startTransaction();

    try {
      await this.dependencyTiersRepository.update(
        tierId,
        {
          tierCode:
            dto.tierCode !== undefined
              ? dto.tierCode.trim()
              : undefined,

          description:
            dto.description !== undefined
              ? dto.description?.trim() ||
                null
              : undefined,

          isActive:
            dto.isActive !== undefined
              ? this.toDbActive(
                  dto.isActive,
                )
              : undefined,

          modifiedBy:
            user.userId,
        },
        qr,
      );

      await qr.commitTransaction();
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }

      throw error;
    } finally {
      await qr.release();
    }

    return this.findById(
      tierId,
    );
  }

  // ============================================================
  // DELETE
  // ============================================================

  async remove(
    tierId: string,
    user: ICurrentUser,
  ): Promise<void> {
    const existing =
      await this.dependencyTiersRepository.findById(
        tierId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            DEPENDENCY_TIER_ERROR_CODES.DEPENDENCY_TIER_NOT_FOUND,

          message:
            `Dependency Tier [${tierId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();
    await qr.startTransaction();

    try {
      await this.dependencyTiersRepository.softDelete(
        tierId,
        user.userId,
        qr,
      );

      await qr.commitTransaction();
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }

      throw error;
    } finally {
      await qr.release();
    }
  }
}