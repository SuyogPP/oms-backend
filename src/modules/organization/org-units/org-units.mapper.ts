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
    rules: IOrgUnitHierarchyRule[] = [],
  ): OrgUnitTypeEntity {
    const allowedChildTypes = rules
      .filter((r) => r.parentOrgUnitTypeId === row.orgUnitTypeId)
      .map((r) => r.childOrgUnitTypeId);

    return {
      orgUnitTypeId: row.orgUnitTypeId,
      code: row.code,
      name: row.name,
      nameAr: row.nameAr ?? null,
      description: row.description ?? null,
      canonicalLevel: row.canonicalLevel,
      scopeLevelCode: row.scopeLevelCode,
      allowsBudget: Boolean(row.allowsBudget),
      allowsRequisition: Boolean(row.allowsRequisition),
      allowsManager: Boolean(row.allowsManager),
      isRootType: Boolean(row.isRootType),
      sortOrder: row.sortOrder,
      isActive: Boolean(row.isActive),
      allowedChildTypeIds: allowedChildTypes,
    };
  }

  toOrgUnitTypeEntities(
    types: IOrgUnitType[],
    rules: IOrgUnitHierarchyRule[] = [],
  ): OrgUnitTypeEntity[] {
    return types.map((t) => this.toOrgUnitTypeEntity(t, rules));
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
      parentOrgUnitId: row.parentOrgUnitId ?? null,
      code: row.code,
      name: row.name,
      nameAr: row.nameAr ?? null,
      shortName: row.shortName ?? null,
      description: row.description ?? null,
      depth: row.depth,
      costCenterCode: row.costCenterCode ?? null,
      oracleOrgCode: row.oracleOrgCode ?? null,
      emailAddress: row.emailAddress ?? null,
      phoneNumber: row.phoneNumber ?? null,
      head: head ?? null,
      allowsBudget: Boolean(type?.allowsBudget),
      allowsRequisition: Boolean(type?.allowsRequisition),
      sortOrder: row.sortOrder,
      effectiveFrom:
        typeof row.effectiveFrom === 'string'
          ? row.effectiveFrom
          : new Date(row.effectiveFrom).toISOString().split('T')[0],
      effectiveTo: row.effectiveTo
        ? typeof row.effectiveTo === 'string'
          ? row.effectiveTo
          : new Date(row.effectiveTo).toISOString().split('T')[0]
        : null,
      isActive: Boolean(row.isActive),
      rowVersion: row.rowVersion,
    };
  }

  toOrgUnitDetailEntity(
    row: IOrgUnit,
    type: IOrgUnitType,
    head: OrgHeadSummaryEntity | null,
    childCount: number,
    descendantCount: number,
    breadcrumb: OrgBreadcrumbItemEntity[],
  ): OrgUnitDetailEntity {
    const base = this.toOrgUnitEntity(row, type, head);
    return {
      ...base,
      childCount,
      descendantCount,
      breadcrumb,
    };
  }

  /**
   * Constructs nested N-ary tree from flat list of visible organization units.
   */
  toOrgUnitTree(
    rows: IOrgUnit[],
    typesMap: Map<number, IOrgUnitType>,
    headsMap: Map<string, OrgHeadSummaryEntity> = new Map(),
  ): OrgUnitTreeItemEntity[] {
    const nodeMap = new Map<string, OrgUnitTreeItemEntity>();
    const roots: OrgUnitTreeItemEntity[] = [];

    // 1. Initialize node representations
    for (const r of rows) {
      const type = typesMap.get(r.orgUnitTypeId);
      const node: OrgUnitTreeItemEntity = {
        orgUnitId: r.orgUnitId,
        orgUnitTypeId: r.orgUnitTypeId,
        parentOrgUnitId: r.parentOrgUnitId ?? null,
        code: r.code,
        name: r.name,
        nameAr: r.nameAr ?? null,
        depth: r.depth,
        allowsBudget: Boolean(type?.allowsBudget),
        allowsRequisition: Boolean(type?.allowsRequisition),
        isActive: Boolean(r.isActive),
        head: headsMap.get(r.orgUnitId) ?? null,
        children: [],
      };
      nodeMap.set(r.orgUnitId.toLowerCase(), node);
    }

    // 2. Build parent-child hierarchy
    for (const r of rows) {
      const node = nodeMap.get(r.orgUnitId.toLowerCase())!;
      if (r.parentOrgUnitId && nodeMap.has(r.parentOrgUnitId.toLowerCase())) {
        const parent = nodeMap.get(r.parentOrgUnitId.toLowerCase())!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
