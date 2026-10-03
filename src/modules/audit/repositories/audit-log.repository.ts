import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AUDIT_DB_CONNECTION } from '../../../database/database.constants';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * DTO for writing a new audit log entry.
 * All optional fields default to NULL in the database.
 */
export interface CreateAuditLogDto
  extends Omit<AuditLog, 'audit_id' | 'performed_at'> {
  /**
   * Optional override for the timestamp.
   * Defaults to SYSUTCDATETIME() in the DB if omitted.
   */
  performed_at?: Date;
}

/**
 * AuditLogRepository
 *
 * Dedicated repository for [dbo].[tbl_Audit_Log] in **DIEZ-AUDIT-DB**.
 * Uses the named `AUDIT_DB_CONNECTION` DataSource — completely isolated
 * from the primary OMS DataSource to prevent cross-DB coupling.
 *
 * Design decisions:
 * - Raw SQL only (no TypeORM entities) to keep the audit DB schema-agnostic.
 * - All writes are fire-and-forget (errors are caught + logged, never thrown)
 *   so audit failures never block the primary business flow.
 * - Reads surface structured `AuditLog` objects for type safety.
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
   * Swallows errors silently to prevent audit failures from disrupting callers.
   *
   * @returns The generated audit_id UUID, or null if the insert failed.
   */
  async insert(dto: CreateAuditLogDto): Promise<string | null> {
    try {
      const result = await this.auditDataSource.query<{ audit_id: string }[]>(
        `
        INSERT INTO [dbo].[tbl_Audit_Log]
        (
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
        OUTPUT INSERTED.audit_id
        VALUES
        (
          @0, @1, @2, @3, @4, @5,
          @6, @7, @8, @9, @10, @11,
          @12, @13, @14, @15,
          ISNULL(@16, SYSUTCDATETIME())
        )
        `,
        [
          dto.transaction_id ?? null,
          dto.source_db ?? null,
          dto.schema_name ?? 'dbo',
          dto.table_name,
          dto.record_id ?? null,
          dto.record_id_text ?? null,
          dto.operation,
          dto.old_values ?? null,
          dto.new_values ?? null,
          dto.changed_columns ?? null,
          dto.performed_by ?? null,
          dto.performed_by_name ?? null,
          dto.source_app ?? 'OMS-Backend',
          dto.source_module ?? null,
          dto.client_ip ?? null,
          dto.reason ?? null,
          dto.performed_at ?? null,
        ],
      );

      return result?.[0]?.audit_id ?? null;
    } catch (err) {
      this.logger.error(
        `[AuditLogRepository] Failed to insert audit log for table="${dto.table_name}" op="${dto.operation}"`,
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
   *
   * @param tableName  Target table name (e.g. 'tbl_Users')
   * @param recordIdText  UUID / text PK of the record
   * @param limit  Max rows to return (default 100)
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
   * Useful for grouping related changes (e.g. a bulk operation).
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
