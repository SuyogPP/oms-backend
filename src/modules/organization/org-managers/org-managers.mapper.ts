import { Injectable } from '@nestjs/common';
import { OrgManagerEntity } from './entities/org-manager.entity';
import { IOrgUnitManager } from './interfaces/org-manager.interface';

@Injectable()
export class OrgManagersMapper {
  toEntity(row: IOrgUnitManager): OrgManagerEntity {
    return {
      orgUnitManagerId: row.orgUnitManagerId,
      orgUnitId: row.orgUnitId,
      orgUnitName: row.orgUnitName,
      orgUnitCode: row.orgUnitCode,
      userId: row.userId,
      username: row.username,
      userDisplayName: row.userDisplayName || row.username,
      userEmail: row.userEmail,
      managerRoleCode: row.managerRoleCode,
      isPrimary: Boolean(row.isPrimary),
      effectiveFrom:
        typeof row.effectiveFrom === 'string'
          ? row.effectiveFrom
          : new Date(row.effectiveFrom).toISOString().split('T')[0],
      effectiveTo: row.effectiveTo
        ? typeof row.effectiveTo === 'string'
          ? row.effectiveTo
          : new Date(row.effectiveTo).toISOString().split('T')[0]
        : null,
      assignmentReason: row.assignmentReason ?? null,
      isActive: Boolean(row.isActive),
    };
  }

  toEntities(rows: IOrgUnitManager[]): OrgManagerEntity[] {
    return rows.map((r) => this.toEntity(r));
  }
}
