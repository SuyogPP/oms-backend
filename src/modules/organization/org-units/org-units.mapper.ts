import { Injectable } from '@nestjs/common';
import {
  OrgBreadcrumbItemEntity,
  OrgHeadSummaryEntity,
  OrgUnitDetailEntity,
  OrgUnitEntity,
  OrgUnitTreeItemEntity,
} from './entities/org-unit.entity';
import {
  OrgUnitTypeEntity,
  OrgUnitTypeHierarchyRuleEntity,
} from './entities/org-unit-type.entity';
import {
  IOrgUnit,
  IOrgUnitHierarchyRule,
  IOrgUnitType,
} from './interfaces/org-unit.interface';

@Injectable()
export class OrgUnitsMapper {
  toOrgUnitTypeEntity(
    row: IOrgUnitType,
  ): OrgUnitTypeEntity {
    return {
      unitTypeId: row.unitTypeId,
      parentUnitTypeId: row.parentUnitTypeId,
      orgUnitCode: row.orgUnitCode,
      orgUnitName: row.orgUnitName,
      level: row.level,
      allowsBudget: Boolean(row.allowsBudget),
      allowsRequisition: Boolean(row.allowsRequisition),
      isActive: Boolean(row.isActive),
    };
  }

  toOrgUnitTypeEntities(
    types: IOrgUnitType[],
  ): OrgUnitTypeEntity[] {
    return types.map((t) => this.toOrgUnitTypeEntity(t));
  }

  toHierarchyRuleEntities(
    rules: IOrgUnitHierarchyRule[],
  ): OrgUnitTypeHierarchyRuleEntity[] {
    return rules.map((r) => ({
      childOrgUnitTypeId: r.childOrgUnitTypeId,
      parentOrgUnitTypeId: r.parentOrgUnitTypeId,
      isActive: Boolean(r.isActive),
      createdBy: r.createdBy ?? null,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
    }));
  }

  toOrgUnitEntity(
    row: IOrgUnit,
    type: IOrgUnitType,
    head: OrgHeadSummaryEntity | null = null,
  ): OrgUnitEntity {
    return {
      orgUnitId: row.orgUnitId,
      orgUnitType: this.toOrgUnitTypeEntity(type),
      parentId: row.parentId ?? null,
      orgCode: row.orgCode,
      orgName: row.orgName,
      costCenterCode: row.costCenterCode ?? null,
      adObjectGuid: row.adObjectGuid ?? null,
      head: head ?? null,
      allowsBudget: Boolean(type?.allowsBudget),
      allowsRequisition: Boolean(type?.allowsRequisition),
      isActive: Boolean(row.isActive),
    };
  }

  toOrgUnitDetailEntity(
    row: IOrgUnit,
    type: IOrgUnitType,
    head: OrgHeadSummaryEntity | null,
    childCount: number,
    descendantCount: number,
    breadcrumb: OrgBreadcrumbItemEntity[],
    peopleCount?: number,
  ): OrgUnitDetailEntity {
    const base = this.toOrgUnitEntity(row, type, head);
    return {
      ...base,
      childCount,
      descendantCount,
      peopleCount: peopleCount ?? 0,
      breadcrumb,
    };
  }

  toOrgUnitTree(
    rows: IOrgUnit[],
    typesMap: Map<number, IOrgUnitType>,
    headsMap: Map<number, OrgHeadSummaryEntity> = new Map(),
  ): OrgUnitTreeItemEntity[] {
    const nodeMap = new Map<number, OrgUnitTreeItemEntity>();
    const roots: OrgUnitTreeItemEntity[] = [];

    // 1. Initialize node representations
    for (const r of rows) {
      const type = typesMap.get(r.unitTypeId);
      const node: OrgUnitTreeItemEntity = {
        orgUnitId: r.orgUnitId,
        unitTypeId: r.unitTypeId,
        parentId: r.parentId ?? null,
        orgCode: r.orgCode,
        orgName: r.orgName,
        allowsBudget: Boolean(type?.allowsBudget),
        allowsRequisition: Boolean(type?.allowsRequisition),
        isActive: Boolean(r.isActive),
        head: headsMap.get(r.orgUnitId) ?? null,
        children: [],
      };
      nodeMap.set(r.orgUnitId, node);
    }

    // 2. Build parent-child hierarchy
    for (const r of rows) {
      const node = nodeMap.get(r.orgUnitId)!;
      if (r.parentId && nodeMap.has(r.parentId)) {
        const parent = nodeMap.get(r.parentId)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
