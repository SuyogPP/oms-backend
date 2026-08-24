import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

@Injectable()
export class UserImportRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Batch checks existing emails to identify collision errors during import validation.
   */
  async findExistingEmails(
    emails: string[],
    qr?: QueryRunner,
  ): Promise<string[]> {
    if (!emails || emails.length === 0) return [];
    const placeholders = emails.map((_, i) => `@${i}`).join(', ');
    const rows = await this.getExecutor(qr).query(
      `SELECT LOWER(Email) as email FROM [auth].[Users] WHERE LOWER(Email) IN (${placeholders})`,
      emails.map((e) => e.toLowerCase()),
    );
    return rows.map((r: any) => r.email);
  }

  /**
   * Batch checks existing usernames.
   */
  async findExistingUsernames(
    usernames: string[],
    qr?: QueryRunner,
  ): Promise<string[]> {
    if (!usernames || usernames.length === 0) return [];
    const placeholders = usernames.map((_, i) => `@${i}`).join(', ');
    const rows = await this.getExecutor(qr).query(
      `SELECT LOWER(Username) as username FROM [auth].[Users] WHERE LOWER(Username) IN (${placeholders})`,
      usernames.map((u) => u.toLowerCase()),
    );
    return rows.map((r: any) => r.username);
  }

  /**
   * Batch finds org units by codes.
   */
  async findOrgUnitsByCodes(
    codes: string[],
    qr?: QueryRunner,
  ): Promise<Array<{ code: string; orgUnitId: string }>> {
    if (!codes || codes.length === 0) return [];
    const placeholders = codes.map((_, i) => `@${i}`).join(', ');
    const rows = await this.getExecutor(qr).query(
      `SELECT Code as code, OrgUnitId as orgUnitId FROM [org].[OrgUnits] WHERE Code IN (${placeholders}) AND IsDeleted = 0`,
      codes,
    );
    return rows.map((r: any) => ({ code: r.code, orgUnitId: r.orgUnitId }));
  }

  /**
   * Batch finds role IDs by role codes.
   */
  async findRolesByCodes(
    roleCodes: string[],
    qr?: QueryRunner,
  ): Promise<Array<{ roleCode: string; roleId: string }>> {
    if (!roleCodes || roleCodes.length === 0) return [];
    const placeholders = roleCodes.map((_, i) => `@${i}`).join(', ');
    const rows = await this.getExecutor(qr).query(
      `SELECT RoleCode as roleCode, RoleID as roleId FROM [auth].[Roles] WHERE RoleCode IN (${placeholders}) AND IsActive = 1`,
      roleCodes,
    );
    return rows.map((r: any) => ({
      roleCode: r.roleCode,
      roleId: r.roleId,
    }));
  }
}
