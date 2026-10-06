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
  GRADE_BENEFIT_ERROR_CODES,
} from '../grade-benefit.constants';

import {
  CreateGradeBenefitDto,
} from '../dto/create-grade-benefit.dto';

import {
  UpdateGradeBenefitDto,
} from '../dto/update-grade-benefit.dto';

import {
  GradeBenefitEntity,
} from '../entities/grade-benefit.entity';

import {
  IGradeBenefit,
} from '../interfaces/grade-benefit.interface';

import {
  GradeBenefitsRepository,
} from '../repositories/grade-benefits.repository';

@Injectable()
export class GradeBenefitsService {
  constructor(
    private readonly gradeBenefitsRepository: GradeBenefitsRepository,
    private readonly dataSource: DataSource,
  ) {}

  private toBoolean(
    value: string | null,
  ): boolean {
    return value?.toLowerCase() ===
      'true';
  }

  private toDbActive(
    value: boolean,
  ): string {
    return value
      ? 'True'
      : 'False';
  }

  private toEntity(
    row: IGradeBenefit,
  ): GradeBenefitEntity {
    return {
      ...row,

      minSalary:
        row.minSalary !== null
          ? Number(row.minSalary)
          : null,

      maxSalary:
        row.maxSalary !== null
          ? Number(row.maxSalary)
          : null,

      officeSetup:
        Boolean(row.officeSetup),

      isActive:
        this.toBoolean(
          row.isActive,
        ),
    };
  }

  private async validateReferences(
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
    const result =
      await this.gradeBenefitsRepository.validateReferences(
        data,
        qr,
      );

    const checks = [
      [
        result.deploymentExists,
        GRADE_BENEFIT_ERROR_CODES.INVALID_DEPLOYMENT,
        'Deployment Model',
      ],
      [
        result.categoryExists,
        GRADE_BENEFIT_ERROR_CODES.INVALID_CATEGORY,
        'Category',
      ],
      [
        result.designationExists,
        GRADE_BENEFIT_ERROR_CODES.INVALID_DESIGNATION,
        'Designation',
      ],
      [
        result.gradeExists,
        GRADE_BENEFIT_ERROR_CODES.INVALID_GRADE,
        'Grade',
      ],
      [
        result.tierExists,
        GRADE_BENEFIT_ERROR_CODES.INVALID_TIER,
        'Dependency Tier',
      ],
      [
        result.benefitExists,
        GRADE_BENEFIT_ERROR_CODES.INVALID_BENEFIT,
        'Benefit',
      ],
    ] as const;

    for (
      const [
        exists,
        code,
        label,
      ] of checks
    ) {
      if (!exists) {
        throw new HttpException(
          {
            code,
            message:
              `${label} does not exist.`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async findById(
    salaryGradeId: string,
  ): Promise<GradeBenefitEntity> {
    const row =
      await this.gradeBenefitsRepository.findById(
        salaryGradeId,
      );

    if (!row) {
      throw new HttpException(
        {
          code:
            GRADE_BENEFIT_ERROR_CODES.NOT_FOUND,

          message:
            `Salary & Grade record [${salaryGradeId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toEntity(row);
  }

  async findAll(
    options: {
      deploymentId?: string;
      isActive?: boolean;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const page =
      options.page ?? 1;

    const pageSize =
      options.pageSize ?? 20;

    const [
      result,
      counts,
    ] =
      await Promise.all([
        this.gradeBenefitsRepository.findAll(
          {
            deploymentId:
              options.deploymentId,

            isActive:
              options.isActive !==
              undefined
                ? this.toDbActive(
                    options.isActive,
                  )
                : undefined,

            search:
              options.search?.trim(),

            page,
            pageSize,
          },
        ),

        this.gradeBenefitsRepository.getCounts(
          options.deploymentId,
        ),
      ]);

    return {
      counts,

      data:
        result.rows.map(
          (row) =>
            this.toEntity(row),
        ),

      total:
        result.total,

      page,

      pageSize,
    };
  }

  async create(
    dto: CreateGradeBenefitDto,
    user: ICurrentUser,
  ): Promise<GradeBenefitEntity> {
    await this.validateReferences(
      dto,
    );

    const duplicate =
      await this.gradeBenefitsRepository.findDuplicate(
        {
          deploymentId:
            dto.deploymentId,

          categoryId:
            dto.categoryId,

          designationId:
            dto.designationId,

          gradeId:
            dto.gradeId,

          tierId:
            dto.tierId,

          benefitId:
            dto.benefitId,

          officeSetup:
            dto.officeSetup,
        },
      );

    if (duplicate) {
      throw new HttpException(
        {
          code:
            GRADE_BENEFIT_ERROR_CODES.DUPLICATE,

          message:
            'This Salary & Grade combination already exists.',
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
        await this.gradeBenefitsRepository.create(
          {
            deploymentId:
              dto.deploymentId,

            categoryId:
              dto.categoryId,

            designationId:
              dto.designationId,

            gradeId:
              dto.gradeId,

            tierId:
              dto.tierId,

            benefitId:
              dto.benefitId,

            officeSetup:
              dto.officeSetup,

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
    } catch (error) {
      if (
        qr.isTransactionActive
      ) {
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
    salaryGradeId: string,
    dto: UpdateGradeBenefitDto,
    user: ICurrentUser,
  ): Promise<GradeBenefitEntity> {
    const existing =
      await this.gradeBenefitsRepository.findById(
        salaryGradeId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            GRADE_BENEFIT_ERROR_CODES.NOT_FOUND,

          message:
            `Salary & Grade record [${salaryGradeId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const effective = {
      deploymentId:
        dto.deploymentId ??
        existing.deploymentId,

      categoryId:
        dto.categoryId ??
        existing.categoryId,

      designationId:
        dto.designationId ??
        existing.designationId,

      gradeId:
        dto.gradeId ??
        existing.gradeId,

      tierId:
        dto.tierId ??
        existing.tierId,

      benefitId:
        dto.benefitId ??
        existing.benefitId,

      officeSetup:
        dto.officeSetup ??
        existing.officeSetup,
    };

    await this.validateReferences(
      effective,
    );

    const duplicate =
      await this.gradeBenefitsRepository.findDuplicate(
        effective,
        salaryGradeId,
      );

    if (duplicate) {
      throw new HttpException(
        {
          code:
            GRADE_BENEFIT_ERROR_CODES.DUPLICATE,

          message:
            'This Salary & Grade combination already exists.',
        },
        HttpStatus.CONFLICT,
      );
    }

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();
    await qr.startTransaction();

    try {
      await this.gradeBenefitsRepository.update(
        salaryGradeId,
        {
          deploymentId:
            dto.deploymentId,

          categoryId:
            dto.categoryId,

          designationId:
            dto.designationId,

          gradeId:
            dto.gradeId,

          tierId:
            dto.tierId,

          benefitId:
            dto.benefitId,

          officeSetup:
            dto.officeSetup,

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
    } catch (error) {
      if (
        qr.isTransactionActive
      ) {
        await qr.rollbackTransaction();
      }

      throw error;
    } finally {
      await qr.release();
    }

    return this.findById(
      salaryGradeId,
    );
  }

  async remove(
    salaryGradeId: string,
    user: ICurrentUser,
  ): Promise<void> {
    const existing =
      await this.gradeBenefitsRepository.findById(
        salaryGradeId,
      );

    if (!existing) {
      throw new HttpException(
        {
          code:
            GRADE_BENEFIT_ERROR_CODES.NOT_FOUND,

          message:
            `Salary & Grade record [${salaryGradeId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const qr: QueryRunner =
      this.dataSource.createQueryRunner();

    await qr.connect();
    await qr.startTransaction();

    try {
      await this.gradeBenefitsRepository.softDelete(
        salaryGradeId,
        user.userId,
        qr,
      );

      await qr.commitTransaction();
    } catch (error) {
      if (
        qr.isTransactionActive
      ) {
        await qr.rollbackTransaction();
      }

      throw error;
    } finally {
      await qr.release();
    }
  }
}