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
  BENEFIT_ERROR_CODES,
} from '../benefit.constants';

import {
  CreateBenefitDto,
} from '../dto/create-benefit.dto';

import {
  UpdateBenefitDto,
} from '../dto/update-benefit.dto';

import {
  BenefitEntity,
} from '../entities/benefit.entity';

import {
  IBenefit,
} from '../interfaces/benefit.interface';

import {
  BenefitsRepository,
} from '../repositories/benefits.repository';

@Injectable()
export class BenefitsService {
  constructor(
    private readonly benefitsRepository: BenefitsRepository,
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
    row: IBenefit,
  ): BenefitEntity {
    return {
      benefitId:
        row.benefitId,

      benefitName:
        row.benefitName,

      benefitDescription:
        row.benefitDescription,

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

  async findById(
    benefitId: string,
  ): Promise<BenefitEntity> {
    const row =
      await this.benefitsRepository.findById(
        benefitId,
      );

    if (!row) {
      throw new HttpException(
        {
          code:
            BENEFIT_ERROR_CODES.BENEFIT_NOT_FOUND,

          message:
            `Benefit [${benefitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toEntity(row);
  }

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
      await this.benefitsRepository.findAll(
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

  async create(
    dto: CreateBenefitDto,
    user: ICurrentUser,
  ): Promise<BenefitEntity> {
    const benefitName =
      dto.benefitName.trim();

    const existing =
      await this.benefitsRepository.findByName(
        benefitName,
      );

    if (existing) {
      throw new HttpException(
        {
          code:
            BENEFIT_ERROR_CODES.BENEFIT_NAME_DUPLICATE,

          message:
            `A benefit with name [${benefitName}] already exists.`,
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
        await this.benefitsRepository.create(
          {
            benefitName,

            benefitDescription:
              dto.benefitDescription !== undefined
                ? dto.benefitDescription?.trim() ||
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

  async update(
    benefitId: string,
    dto: UpdateBenefitDto,
    user: ICurrentUser,
  ): Promise<BenefitEntity> {
    const existing =
      await this.benefitsRepository.findById(
        benefitId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            BENEFIT_ERROR_CODES.BENEFIT_NOT_FOUND,

          message:
            `Benefit [${benefitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      dto.benefitName !== undefined
    ) {
      const newName =
        dto.benefitName.trim();

      if (
        newName.toLowerCase() !==
        existing.benefitName.toLowerCase()
      ) {
        const duplicate =
          await this.benefitsRepository.findByName(
            newName,
          );

        if (
          duplicate &&
          duplicate.benefitId !== benefitId
        ) {
          throw new HttpException(
            {
              code:
                BENEFIT_ERROR_CODES.BENEFIT_NAME_DUPLICATE,

              message:
                `A benefit with name [${newName}] already exists.`,
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
      await this.benefitsRepository.update(
        benefitId,
        {
          benefitName:
            dto.benefitName !== undefined
              ? dto.benefitName.trim()
              : undefined,

          benefitDescription:
            dto.benefitDescription !== undefined
              ? dto.benefitDescription?.trim() ||
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
      benefitId,
    );
  }

  async remove(
    benefitId: string,
    user: ICurrentUser,
  ): Promise<void> {
    const existing =
      await this.benefitsRepository.findById(
        benefitId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            BENEFIT_ERROR_CODES.BENEFIT_NOT_FOUND,

          message:
            `Benefit [${benefitId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();
    await qr.startTransaction();

    try {
      await this.benefitsRepository.softDelete(
        benefitId,
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