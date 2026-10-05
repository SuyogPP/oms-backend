import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AUDIT_DB_CONNECTION } from '../../../database/database.constants';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * DTO for writing a new audit log entry.
 * All optional fields default to NULL in the database.
 */
export type CreateAuditLogDto = Partial<
  Omit<AuditLog, 'audit_id' | 'performed_at'>
> & {
  table_name: string;
  operation: string;
  performed_at?: Date;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUUID = (val?: string | null): boolean => {
  if (!val) return false;
  return UUID_REGEX.test(val);
};

/**
 * AuditLogRepository
 *
 * Dedicated repository for [dbo].[tbl_Audit_Log] in **DIEZ-AUDIT-DB**.
 * Uses the named `AUDIT_DB_CONNECTION` DataSource — completely isolated
 * from the primary OMS DataSource to prevent cross-DB coupling.
 */
@Injectable()
export class AuditLogRepository {
  private readonly logger = new Logger(AuditLogRepository.name);

  constructor(
    @InjectDataSource(AUDIT_DB_CONNECTION)
    private readonly auditDataSource: DataSource,
  ) {}

  // ─── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Inserts one row into [dbo].[tbl_Audit_Log].
   * Handles NOT NULL constraints for transaction_id, source_db, schema_name,
   * table_name, operation, source_app, performed_at.
   */
  async insert(dto: CreateAuditLogDto): Promise<string | null> {
    try {
      const sql = `
        INSERT INTO [dbo].[tbl_Audit_Log]
        (
          audit_id,
          transaction_id,
          source_db,
          schema_name,
          table_name,
          record_id,
          record_id_text,
          operation,
          old_values,
          new_values,
          changed_columns,
          performed_by,
          performed_by_name,
          source_app,
          source_module,
          client_ip,
          reason,
          performed_at
        )
        VALUES
        (
          NEWID(),
          ISNULL(@0, NEWID()),
          ISNULL(@1, 'DIEZ-BUILD-DB'),
          ISNULL(@2, 'masters'),
          @3,
          @4,
          @5,
          @6,
          @7,
          @8,
          @9,
          @10,
          ISNULL(@11, 'OMS-Backend'),
          @12,
          @13,
          @14,
          ISNULL(@15, SYSUTCDATETIME())
        );
      `;

      const recordIdUUID =
        dto.record_id_text && isUUID(dto.record_id_text)
          ? dto.record_id_text
          : null;

      const performedByUUID =
        dto.performed_by && isUUID(dto.performed_by)
          ? dto.performed_by
          : null;

      await this.auditDataSource.query(sql, [
        dto.transaction_id || null, // @0
        dto.source_db || null, // @1
        dto.schema_name || 'masters', // @2
        dto.table_name, // @3
        recordIdUUID, // @4 (uniqueidentifier record_id)
        dto.record_id_text || null, // @5 (varchar record_id_text)
        dto.operation, // @6
        dto.old_values || null, // @7
        dto.new_values || null, // @8
        dto.changed_columns || null, // @9
        performedByUUID, // @10 (uniqueidentifier performed_by)
        dto.performed_by_name || null, // @11
        dto.source_app || 'OMS-Backend', // @12
        dto.source_module || 'BudgetCategoriesModule', // @13
        dto.client_ip || null, // @14
        dto.reason || null, // @15
        dto.performed_at || null, // @16
      ]);

      this.logger.log(
        `[AuditLogRepository] Audit log saved successfully for table="${dto.table_name}" op="${dto.operation}"`,
      );
      return 'SUCCESS';
    } catch (err) {
      this.logger.error(
        `[AuditLogRepository] Failed to insert audit log for table="${dto.table_name}" op="${dto.operation}": ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : String(err),
      );
      return null;
    }
  }

  // ─── Reads ──────────────────────────────────────────────────────────────────

  /**
   * Fetches a single audit log entry by its primary key.
   */
  async findById(auditId: string): Promise<AuditLog | null> {
    const rows = await this.auditDataSource.query<AuditLog[]>(
      `
      SELECT TOP 1
        audit_id, transaction_id, source_db, schema_name,
        table_name, record_id, record_id_text, operation,
        old_values, new_values, changed_columns,
        performed_by, performed_by_name, source_app, source_module,
        client_ip, reason, performed_at
      FROM [dbo].[tbl_Audit_Log]
      WHERE audit_id = @0
      `,
      [auditId],
    );
    return rows?.[0] ?? null;
  }

  /**
   * Fetches audit logs for a specific record within a table, ordered by most recent first.
   */
  async findByRecord(
    tableName: string,
    recordIdText: string,
    limit = 100,
  ): Promise<AuditLog[]> {
    return this.auditDataSource.query<AuditLog[]>(
      `
      SELECT TOP (@0)
        audit_id, transaction_id, source_db, schema_name,
        table_name, record_id, record_id_text, operation,
        old_values, new_values, changed_columns,
        performed_by, performed_by_name, source_app, source_module,
        client_ip, reason, performed_at
      FROM [dbo].[tbl_Audit_Log]
      WHERE table_name = @1 AND record_id_text = @2
      ORDER BY performed_at DESC
      `,
      [limit, tableName, recordIdText],
    );
  }

  /**
   * Fetches all audit logs associated with a transaction ID.
   */
  async findByTransaction(transactionId: string): Promise<AuditLog[]> {
    return this.auditDataSource.query<AuditLog[]>(
      `
      SELECT
        audit_id, transaction_id, source_db, schema_name,
        table_name, record_id, record_id_text, operation,
        old_values, new_values, changed_columns,
        performed_by, performed_by_name, source_app, source_module,
        client_ip, reason, performed_at
      FROM [dbo].[tbl_Audit_Log]
      WHERE transaction_id = @0
      ORDER BY performed_at ASC
      `,
      [transactionId],
    );
  }

  /**
   * Returns the N most recent audit logs globally (for admin dashboards).
   */
  async findRecent(limit = 50): Promise<AuditLog[]> {
    return this.auditDataSource.query<AuditLog[]>(
      `
      SELECT TOP (@0)
        audit_id, transaction_id, source_db, schema_name,
        table_name, record_id, record_id_text, operation,
        old_values, new_values, changed_columns,
        performed_by, performed_by_name, source_app, source_module,
        client_ip, reason, performed_at
      FROM [dbo].[tbl_Audit_Log]
      ORDER BY performed_at DESC
      `,
      [limit],
    );
  }
}
