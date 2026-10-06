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
  CreateCategoryDto,
} from '../dto/create-category.dto';

import {
  UpdateCategoryDto,
} from '../dto/update-category.dto';

import {
  CategoryEntity,
} from '../entities/category.entity';

import {
  ICategory,
} from '../interfaces/category.interface';

import {
  CATEGORY_ERROR_CODES,
} from '../categories.constants';

import {
  CategoriesRepository,
} from '../repositories/categories.repository';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly dataSource: DataSource,
  ) {}

  // ============================================================
  // HELPERS
  // ============================================================

  /**
   * Convert DB NVARCHAR is_active value
   * into a proper boolean for the API.
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
   * Convert API boolean into the value stored
   * inside masters.tbl_category.is_active.
   */
  private toDbActive(
    value: boolean,
  ): string {
    return value
      ? 'True'
      : 'False';
  }

  /**
   * Convert raw database row into the
   * response entity returned to frontend.
   */
  private toEntity(
    row: ICategory,
  ): CategoryEntity {
    return {
      categoryId:
        row.categoryId,

      categoryCode:
        row.categoryCode,

      categoryDetails:
        row.categoryDetails,

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
    categoryId: string,
  ): Promise<CategoryEntity> {
    const row =
      await this.categoriesRepository.findById(
        categoryId,
      );

    if (!row) {
      throw new HttpException(
        {
          code:
            CATEGORY_ERROR_CODES.CATEGORY_NOT_FOUND,

          message:
            `Category [${categoryId}] was not found.`,
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
      await this.categoriesRepository.findAll(
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
    dto: CreateCategoryDto,
    user: ICurrentUser,
  ): Promise<CategoryEntity> {
    const categoryCode =
      dto.categoryCode.trim();

    const existing =
      await this.categoriesRepository.findByCode(
        categoryCode,
      );

    if (existing) {
      throw new HttpException(
        {
          code:
            CATEGORY_ERROR_CODES.CATEGORY_CODE_DUPLICATE,

          message:
            `A category with code [${categoryCode}] already exists.`,
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
        await this.categoriesRepository.create(
          {
            categoryCode,

            categoryDetails:
              dto.categoryDetails !==
              undefined
                ? dto.categoryDetails
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
    categoryId: string,
    dto: UpdateCategoryDto,
    user: ICurrentUser,
  ): Promise<CategoryEntity> {
    const existing =
      await this.categoriesRepository.findById(
        categoryId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            CATEGORY_ERROR_CODES.CATEGORY_NOT_FOUND,

          message:
            `Category [${categoryId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    /**
     * If category code is being changed,
     * check that another record does not
     * already use that code.
     */
    if (
      dto.categoryCode !==
      undefined
    ) {
      const newCode =
        dto.categoryCode.trim();

      if (
        newCode.toLowerCase() !==
        existing.categoryCode.toLowerCase()
      ) {
        const duplicate =
          await this.categoriesRepository.findByCode(
            newCode,
          );

        if (
          duplicate &&
          duplicate.categoryId !==
            categoryId
        ) {
          throw new HttpException(
            {
              code:
                CATEGORY_ERROR_CODES.CATEGORY_CODE_DUPLICATE,

              message:
                `A category with code [${newCode}] already exists.`,
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
      await this.categoriesRepository.update(
        categoryId,
        {
          categoryCode:
            dto.categoryCode !==
            undefined
              ? dto.categoryCode.trim()
              : undefined,

          categoryDetails:
            dto.categoryDetails !==
            undefined
              ? dto.categoryDetails
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
        categoryId,
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
    categoryId: string,
    user: ICurrentUser,
  ): Promise<void> {
    const existing =
      await this.categoriesRepository.findById(
        categoryId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            CATEGORY_ERROR_CODES.CATEGORY_NOT_FOUND,

          message:
            `Category [${categoryId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();

    await qr.startTransaction();

    try {
      await this.categoriesRepository.softDelete(
        categoryId,
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