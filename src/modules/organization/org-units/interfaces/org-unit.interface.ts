export interface IOrgUnitType {
  unitTypeId: number;
  parentUnitTypeId: number | null;
  orgUnitCode: string;
  orgUnitName: string;
  level: number;
  allowsBudget: boolean;
  allowsRequisition: boolean;
  isActive: boolean;
}

export interface IOrgUnitHierarchyRule {
  childOrgUnitTypeId: number;
  parentOrgUnitTypeId: number;
  isActive: boolean;
  createdBy?: string | null;
  createdAt: Date;
}

export interface IOrgUnit {
  orgUnitId: number;
  parentId: number | null;
  unitTypeId: number;
  orgCode: string;
  orgName: string;
  costCenterCode: string | null;
  adObjectGuid: string | null;
  isActive: boolean;
}

export interface IOrgUnitChangeLog {
  orgUnitChangeLogId: number;
  orgUnitId: number;
  changeType: string;
  oldParentId: number | null;
  newParentId: number | null;
  oldValues: string | null;
  newValues: string | null;
  reason: string | null;
  performedBy: string | null;
  performedAt: Date;
}

export interface IOrgBreadcrumbItem {
  orgUnitId: number;
  orgCode: string;
  orgName: string;
}

export interface IOrgHeadSummary {
  userId: string;
  displayName: string;
  email?: string;
  effectiveFrom?: string | Date;
}

export interface IOrgTreeItem {
  orgUnitId: number;
  unitTypeId: number;
  parentId: number | null;
  orgCode: string;
  orgName: string;
  allowsBudget: boolean;
  allowsRequisition: boolean;
  isActive: boolean;
  head?: IOrgHeadSummary | null;
  children?: IOrgTreeItem[];
}

export interface IOrgUnitExportRow {
  orgUnitId: number;
  orgCode: string;
  orgName: string;
  typeName: string;
  typeCode: string;
  parentCode: string | null;
  parentName: string | null;
  costCenterCode: string | null;
  headDisplayName: string | null;
  isActive: boolean;
}
