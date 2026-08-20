import { OrgChangeType, OrgUnitTypeId } from '../org-units.constants';

export interface IOrgUnitType {
  orgUnitTypeId: number;
  code: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  canonicalLevel: number;
  scopeLevelCode: string;
  allowsBudget: boolean;
  allowsRequisition: boolean;
  allowsManager: boolean;
  isRootType: boolean;
  sortOrder: number;
  isActive: boolean;
  isDeleted: boolean;
  createdBy?: string | null;
  createdAt: Date;
  updatedBy?: string | null;
  updatedAt?: Date | null;
}

export interface IOrgUnitHierarchyRule {
  childOrgUnitTypeId: number;
  parentOrgUnitTypeId: number;
  isActive: boolean;
  createdBy?: string | null;
  createdAt: Date;
}

export interface IOrgUnit {
  orgUnitId: string;
  orgUnitTypeId: number;
  parentOrgUnitId: string | null;
  code: string;
  name: string;
  nameAr: string | null;
  shortName: string | null;
  description: string | null;
  materializedPath: string;
  depth: number;
  costCenterCode: string | null;
  adObjectGuid: string | null;
  adDistinguishedName: string | null;
  oracleOrgCode: string | null;
  headUserId: string | null;
  emailAddress: string | null;
  phoneNumber: string | null;
  sortOrder: number;
  effectiveFrom: string | Date;
  effectiveTo: string | Date | null;
  isActive: boolean;
  isDeleted: boolean;
  createdBy?: string | null;
  createdAt: Date;
  updatedBy?: string | null;
  updatedAt?: Date | null;
  deletedBy?: string | null;
  deletedAt?: Date | null;
  rowVersion: string;
}

export interface IOrgUnitClosure {
  ancestorOrgUnitId: string;
  descendantOrgUnitId: string;
  depth: number;
}

export interface IOrgUnitChangeLog {
  orgUnitChangeLogId: number;
  orgUnitId: string;
  changeType: OrgChangeType;
  oldParentOrgUnitId: string | null;
  newParentOrgUnitId: string | null;
  oldValues: string | null;
  newValues: string | null;
  affectedNodeCount: number | null;
  reason: string | null;
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  performedBy: string | null;
  performedAt: Date;
}

export interface IOrgBreadcrumbItem {
  orgUnitId: string;
  code: string;
  name: string;
}

export interface IOrgHeadSummary {
  userId: string;
  displayName: string;
  email?: string;
  effectiveFrom: string | Date;
}

export interface IOrgTreeItem {
  orgUnitId: string;
  orgUnitTypeId: OrgUnitTypeId;
  parentOrgUnitId: string | null;
  code: string;
  name: string;
  nameAr: string | null;
  depth: number;
  allowsBudget: boolean;
  allowsRequisition: boolean;
  isActive: boolean;
  head?: IOrgHeadSummary | null;
  children?: IOrgTreeItem[];
}

export interface IOrgUnitExportRow {
  orgUnitId: string;
  code: string;
  name: string;
  nameAr: string | null;
  typeName: string;
  typeCode: string;
  parentCode: string | null;
  parentName: string | null;
  depth: number;
  costCenterCode: string | null;
  headDisplayName: string | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}
