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
  CreateGradeDto,
} from '../dto/create-grade.dto';

import {
  UpdateGradeDto,
} from '../dto/update-grade.dto';

import {
  GradeEntity,
} from '../entities/grade.entity';

import {
  IGrade,
} from '../interfaces/grade.interface';

import {
  GRADE_ERROR_CODES,
} from '../grades.constants';

import {
  GradesRepository,
} from '../repositories/grades.repository';

@Injectable()
export class GradesService {
  constructor(
    private readonly gradesRepository: GradesRepository,
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
   * Convert API boolean into DB value.
   */
  private toDbActive(
    value: boolean,
  ): string {
    return value
      ? 'True'
      : 'False';
  }

  /**
   * Validate salary range.
   *
   * If both salaries exist:
   * maxSalary must be greater than or equal to minSalary.
   */
  private validateSalaryRange(
    minSalary: number | null,
    maxSalary: number | null,
  ): void {
    if (
      minSalary !== null &&
      maxSalary !== null &&
      maxSalary < minSalary
    ) {
      throw new HttpException(
        {
          code:
            GRADE_ERROR_CODES.INVALID_SALARY_RANGE,

          message:
            'Maximum salary must be greater than or equal to minimum salary.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Convert raw database row into API entity.
   */
  private toEntity(
    row: IGrade,
  ): GradeEntity {
    return {
      gradeId:
        row.gradeId,

      gradeCode:
        row.gradeCode,

      gradeDetails:
        row.gradeDetails,

      minSalary:
        row.minSalary !== null
          ? Number(row.minSalary)
          : null,

      maxSalary:
        row.maxSalary !== null
          ? Number(row.maxSalary)
          : null,

      isActive:
        this.toBoolean(
          row.isActive,
        ),

      isDelete:
        row.isDelete,

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
    gradeId: string,
  ): Promise<GradeEntity> {
    const row =
      await this.gradesRepository.findById(
        gradeId,
      );

    if (!row) {
      throw new HttpException(
        {
          code:
            GRADE_ERROR_CODES.GRADE_NOT_FOUND,

          message:
            `Grade [${gradeId}] was not found.`,
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
      await this.gradesRepository.findAll(
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
    dto: CreateGradeDto,
    user: ICurrentUser,
  ): Promise<GradeEntity> {
    const gradeCode =
      dto.gradeCode.trim();

    const existing =
      await this.gradesRepository.findByCode(
        gradeCode,
      );

    if (existing) {
      throw new HttpException(
        {
          code:
            GRADE_ERROR_CODES.GRADE_CODE_DUPLICATE,

          message:
            `A grade with code [${gradeCode}] already exists.`,
        },
        HttpStatus.CONFLICT,
      );
    }

    const minSalary =
      dto.minSalary ?? null;

    const maxSalary =
      dto.maxSalary ?? null;

    this.validateSalaryRange(
      minSalary,
      maxSalary,
    );

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();

    await qr.startTransaction();

    let newId: string;

    try {
      newId =
        await this.gradesRepository.create(
          {
            gradeCode,

            gradeDetails:
              dto.gradeDetails !== undefined
                ? dto.gradeDetails?.trim() ||
                  null
                : null,

            minSalary,

            maxSalary,

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
    gradeId: string,
    dto: UpdateGradeDto,
    user: ICurrentUser,
  ): Promise<GradeEntity> {
    const existing =
      await this.gradesRepository.findById(
        gradeId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            GRADE_ERROR_CODES.GRADE_NOT_FOUND,

          message:
            `Grade [${gradeId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // ----------------------------------------------------------
    // Check duplicate Grade Code
    // ----------------------------------------------------------

    if (
      dto.gradeCode !== undefined
    ) {
      const newCode =
        dto.gradeCode.trim();

      if (
        newCode.toLowerCase() !==
        existing.gradeCode.toLowerCase()
      ) {
        const duplicate =
          await this.gradesRepository.findByCode(
            newCode,
          );

        if (
          duplicate &&
          duplicate.gradeId !== gradeId
        ) {
          throw new HttpException(
            {
              code:
                GRADE_ERROR_CODES.GRADE_CODE_DUPLICATE,

              message:
                `A grade with code [${newCode}] already exists.`,
            },
            HttpStatus.CONFLICT,
          );
        }
      }
    }

    // ----------------------------------------------------------
    // Work out the final salary values after the update
    // ----------------------------------------------------------

    const effectiveMinSalary =
      dto.minSalary !== undefined
        ? dto.minSalary
        : existing.minSalary;

    const effectiveMaxSalary =
      dto.maxSalary !== undefined
        ? dto.maxSalary
        : existing.maxSalary;

    this.validateSalaryRange(
      effectiveMinSalary,
      effectiveMaxSalary,
    );

    // ----------------------------------------------------------
    // Transaction
    // ----------------------------------------------------------

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();

    await qr.startTransaction();

    try {
      await this.gradesRepository.update(
        gradeId,
        {
          gradeCode:
            dto.gradeCode !== undefined
              ? dto.gradeCode.trim()
              : undefined,

          gradeDetails:
            dto.gradeDetails !== undefined
              ? dto.gradeDetails?.trim() ||
                null
              : undefined,

          minSalary:
            dto.minSalary !== undefined
              ? dto.minSalary
              : undefined,

          maxSalary:
            dto.maxSalary !== undefined
              ? dto.maxSalary
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
      gradeId,
    );
  }

  // ============================================================
  // DELETE — SOFT DELETE
  // ============================================================

  async remove(
    gradeId: string,
    user: ICurrentUser,
  ): Promise<void> {
    const existing =
      await this.gradesRepository.findById(
        gradeId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            GRADE_ERROR_CODES.GRADE_NOT_FOUND,

          message:
            `Grade [${gradeId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();

    await qr.startTransaction();

    try {
      await this.gradesRepository.softDelete(
        gradeId,
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
