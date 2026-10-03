import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FiscalYearsRepository } from '../repositories/fiscal-years.repository';
import { AuditLogRepository } from '../../../audit/repositories/audit-log.repository';
import { CreateFiscalYearDto } from '../dto/create-fiscal-year.dto';
import { UpdateFiscalYearDto } from '../dto/update-fiscal-year.dto';
import { ListFiscalYearsDto } from '../dto/list-fiscal-years.dto';
import { IFiscalYear } from '../interfaces/fiscal-year.interface';

export interface IAuditMeta {
  userId?: string;
  userName?: string;
  ip?: string;
}

@Injectable()
export class FiscalYearsService {
  constructor(
    private readonly fiscalYearsRepository: FiscalYearsRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async findAll(query?: ListFiscalYearsDto): Promise<IFiscalYear[]> {
    return this.fiscalYearsRepository.findAll(query);
  }

  async findById(id: string): Promise<IFiscalYear> {
    const fiscalYear = await this.fiscalYearsRepository.findById(id);
    if (!fiscalYear) {
      throw new NotFoundException(`Fiscal year with ID '${id}' not found.`);
    }
    return fiscalYear;
  }

  async create(
    dto: CreateFiscalYearDto,
    meta?: IAuditMeta,
  ): Promise<IFiscalYear> {
    // Check if fiscal year with this code already exists
    const existing = await this.fiscalYearsRepository.findByCode(dto.code);

    let resultFiscalYear: IFiscalYear;
    let oldValues: string | null = null;
    let operation = 'INSERT';
    const createdBy = dto.createdBy;

    if (existing) {
      if (!existing.isDelete) {
        // Active duplicate -> throw conflict error
        throw new ConflictException(
          `Fiscal year with code '${dto.code}' already exists.`,
        );
      } else {
        // Soft-deleted duplicate (isDelete = true) -> Reactivate (set isDelete = false) and update with newly passed values
        oldValues = JSON.stringify(existing);
        operation = 'UPDATE';
        const updated = await this.fiscalYearsRepository.update(
          existing.fiscalYearId,
          {
            code: dto.code,
            startDate: dto.startDate,
            endDate: dto.endDate,
            status: dto.status || 'OPEN',
            oracleBudgetName: dto.oracleBudgetName,
            isDelete: false, // Reactivate!
            reactivate: true,
            createdBy,
            attr1: dto.attr1,
            attr2: dto.attr2,
            attr3: dto.attr3,
            attr4: dto.attr4,
            attr5: dto.attr5,
          },
        );
        resultFiscalYear = updated!;
      }
    } else {
      resultFiscalYear = await this.fiscalYearsRepository.create({
        ...dto,
        status: dto.status || 'OPEN',
        isDelete: false,
        createdBy,
      });
    }

    // Write audit log entry
    await this.auditLogRepository.insert({
      table_name: 'tbl_Fiscal_Year',
      schema_name: 'masters',
      operation,
      record_id_text: resultFiscalYear.fiscalYearId,
      performed_by: meta?.userId || null,
      performed_by_name: meta?.userName || null,
      source_module: 'FiscalYearsModule',
      old_values: oldValues,
      new_values: JSON.stringify(resultFiscalYear),
      client_ip: meta?.ip || null,
    });

    return resultFiscalYear;
  }

  async update(
    id: string | undefined,
    dto: UpdateFiscalYearDto,
    meta?: IAuditMeta,
  ): Promise<IFiscalYear> {
    const targetId = dto.fiscalYearId || id;
    if (!targetId) {
      throw new BadRequestException(
        'Fiscal year ID must be provided in either the URL parameter or request body.',
      );
    }

    const existingFiscalYear = await this.findById(targetId);
    const modifiedBy = dto.modifiedBy || meta?.userId || undefined;

    // If updating code, ensure new code is unique among non-deleted fiscal years
    if (dto.code && dto.code.toLowerCase() !== existingFiscalYear.code.toLowerCase()) {
      const codeDuplicate = await this.fiscalYearsRepository.findByCode(
        dto.code,
      );
      if (
        codeDuplicate &&
        codeDuplicate.fiscalYearId !== targetId &&
        !codeDuplicate.isDelete
      ) {
        throw new ConflictException(
          `Fiscal year with code '${dto.code}' already exists.`,
        );
      }
    }

    const updated = await this.fiscalYearsRepository.update(targetId, {
      ...dto,
      modifiedBy,
    });
    if (!updated) {
      throw new NotFoundException(`Fiscal year with ID '${targetId}' not found.`);
    }

    // Write audit log entry
    await this.auditLogRepository.insert({
      table_name: 'tbl_Fiscal_Year',
      schema_name: 'masters',
      operation: 'UPDATE',
      record_id_text: updated.fiscalYearId,
      performed_by: meta?.userId || null,
      performed_by_name: meta?.userName || null,
      source_module: 'FiscalYearsModule',
      old_values: JSON.stringify(existingFiscalYear),
      new_values: JSON.stringify(updated),
      client_ip: meta?.ip || null,
    });

    return updated;
  }

  async softDelete(
    id: string,
    meta?: IAuditMeta,
  ): Promise<{ success: boolean; message: string }> {
    const existingFiscalYear = await this.findById(id);
    const actorId = meta?.userId || 'system';

    await this.fiscalYearsRepository.softDelete(id, actorId);

    const deletedState = {
      ...existingFiscalYear,
      isDelete: true,
      modifiedBy: actorId,
    };

    // Write audit log entry
    await this.auditLogRepository.insert({
      table_name: 'tbl_Fiscal_Year',
      schema_name: 'masters',
      operation: 'DELETE',
      record_id_text: id,
      performed_by: meta?.userId || null,
      performed_by_name: meta?.userName || null,
      source_module: 'FiscalYearsModule',
      old_values: JSON.stringify(existingFiscalYear),
      new_values: JSON.stringify(deletedState),
      client_ip: meta?.ip || null,
    });

    return {
      success: true,
      message: `Fiscal year with ID '${id}' was soft-deleted successfully.`,
    };
  }
}
