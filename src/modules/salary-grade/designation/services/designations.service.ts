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
  CreateDesignationDto,
} from '../dto/create-designation.dto';

import {
  UpdateDesignationDto,
} from '../dto/update-designation.dto';

import {
  DesignationEntity,
} from '../entities/designation.entity';

import {
  IDesignation,
} from '../interfaces/designation.interface';

import {
  DESIGNATION_ERROR_CODES,
} from '../designations.constants';

import {
  DesignationsRepository,
} from '../repositories/designations.repository';

@Injectable()
export class DesignationsService {
  constructor(
    private readonly designationsRepository: DesignationsRepository,
    private readonly dataSource: DataSource,
  ) {}

  // ============================================================
  // HELPERS
  // ============================================================

  /**
   * Convert DB NVARCHAR is_active value
   * into a boolean for the API.
   */
  private toBoolean(
    value: string | null,
  ): boolean {
    if (!value) {
      return false;
    }

    return value.toLowerCase() === 'true';
  }

  /**
   * Convert API boolean into the value
   * stored in the DB.
   */
  private toDbActive(
    value: boolean,
  ): string {
    return value
      ? 'True'
      : 'False';
  }

  /**
   * Convert raw DB row into API entity.
   */
  private toEntity(
    row: IDesignation,
  ): DesignationEntity {
    return {
      designationId:
        row.designationId,

      designationCode:
        row.designationCode,

      designationName:
        row.designationName,

      designationSummary:
        row.designationSummary,

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
    designationId: string,
  ): Promise<DesignationEntity> {
    const row =
      await this.designationsRepository.findById(
        designationId,
      );

    if (!row) {
      throw new HttpException(
        {
          code:
            DESIGNATION_ERROR_CODES.DESIGNATION_NOT_FOUND,

          message:
            `Designation [${designationId}] was not found.`,
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
      await this.designationsRepository.findAll(
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
    dto: CreateDesignationDto,
    user: ICurrentUser,
  ): Promise<DesignationEntity> {
    const designationCode =
      dto.designationCode.trim();

    const designationName =
      dto.designationName.trim();

    const existing =
      await this.designationsRepository.findByCode(
        designationCode,
      );

    if (existing) {
      throw new HttpException(
        {
          code:
            DESIGNATION_ERROR_CODES.DESIGNATION_CODE_DUPLICATE,

          message:
            `A designation with code [${designationCode}] already exists.`,
        },
        HttpStatus.CONFLICT,
      );
    }

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();

    await qr.startTransaction();

    try {
      const newId =
        await this.designationsRepository.create(
          {
            designationCode,

            designationName,

            designationSummary:
              dto.designationSummary !==
              undefined
                ? dto.designationSummary
                    ?.trim() ||
                  null
                : null,

            isActive:
              this.toDbActive(
                dto.isActive ??
                  true,
              ),

            createdBy:
              user.userId,
          },
          qr,
        );

      await qr.commitTransaction();

      return this.findById(
        newId,
      );
    } catch (error) {
      await qr.rollbackTransaction();

      throw error;
    } finally {
      await qr.release();
    }
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(
    designationId: string,
    dto: UpdateDesignationDto,
    user: ICurrentUser,
  ): Promise<DesignationEntity> {
    const existing =
      await this.designationsRepository.findById(
        designationId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            DESIGNATION_ERROR_CODES.DESIGNATION_NOT_FOUND,

          message:
            `Designation [${designationId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    /**
     * If the designation code is changing,
     * verify another designation does not
     * already use the new code.
     */
    if (
      dto.designationCode !==
      undefined
    ) {
      const newCode =
        dto.designationCode.trim();

      if (
        newCode.toLowerCase() !==
        existing.designationCode.toLowerCase()
      ) {
        const duplicate =
          await this.designationsRepository.findByCode(
            newCode,
          );

        if (
          duplicate &&
          duplicate.designationId !==
            designationId
        ) {
          throw new HttpException(
            {
              code:
                DESIGNATION_ERROR_CODES.DESIGNATION_CODE_DUPLICATE,

              message:
                `A designation with code [${newCode}] already exists.`,
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
      await this.designationsRepository.update(
        designationId,
        {
          designationCode:
            dto.designationCode !==
            undefined
              ? dto.designationCode.trim()
              : undefined,

          designationName:
            dto.designationName !==
            undefined
              ? dto.designationName.trim()
              : undefined,

          designationSummary:
            dto.designationSummary !==
            undefined
              ? dto.designationSummary
                  ?.trim() ||
                null
              : undefined,

          isActive:
            dto.isActive !==
            undefined
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

      return this.findById(
        designationId,
      );
    } catch (error) {
      await qr.rollbackTransaction();

      throw error;
    } finally {
      await qr.release();
    }
  }

  // ============================================================
  // DELETE — SOFT DELETE
  // ============================================================

  async remove(
    designationId: string,
    user: ICurrentUser,
  ): Promise<void> {
    const existing =
      await this.designationsRepository.findById(
        designationId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            DESIGNATION_ERROR_CODES.DESIGNATION_NOT_FOUND,

          message:
            `Designation [${designationId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();

    await qr.startTransaction();

    try {
      await this.designationsRepository.softDelete(
        designationId,
        user.userId,
        qr,
      );

      await qr.commitTransaction();
    } catch (error) {
      await qr.rollbackTransaction();

      throw error;
    } finally {
      await qr.release();
    }
  }
}