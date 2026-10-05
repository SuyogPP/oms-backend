import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class UserOrgUnitAssignmentRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Closes out the active assignment and inserts a new one, returning the new ID.
   * If newOrgUnitId is null, it just closes out the active one.
   */
  async reassignUser(
    userId: string,
    newOrgUnitId: string | null,
    isPrimary: boolean,
    qr?: QueryRunner,
  ): Promise<void> {
    const executor = this.getExecutor(qr);
    
    // 1. Close out the previous active row for this user (where is_primary matches)
    const closeSql = `
      UPDATE auth.tbl_User_Org_Unit_Assignment
      SET
        effective_to = CAST(GETUTCDATE() AS DATE),
        is_active = 0
      WHERE user_id = @0
        AND is_primary = @1
        AND is_active = 1;
    `;
    await executor.query(closeSql, [userId, isPrimary ? 1 : 0]);

    // 2. Insert new row
    if (newOrgUnitId !== null) {
      const insertSql = `
        INSERT INTO auth.tbl_User_Org_Unit_Assignment (
          user_id,
          org_unit_id,
          is_primary,
          effective_from,
          is_active
        ) VALUES (
          @0, @1, @2, CAST(GETUTCDATE() AS DATE), 1
        );
      `;
      await executor.query(insertSql, [userId, newOrgUnitId, isPrimary ? 1 : 0]);
    }
  }
}
