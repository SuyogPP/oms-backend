import { OrgManagerRole } from '../org-managers.constants';

export interface IOrgUnitManager {
  orgUnitManagerId: string;
  orgUnitId: string;
  userId: string;
  managerRoleCode: OrgManagerRole;
  isPrimary: boolean;
  effectiveFrom: string | Date;
  effectiveTo: string | Date | null;
  assignmentReason: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdBy?: string | null;
  createdAt: Date;
  updatedBy?: string | null;
  updatedAt?: Date | null;
  deletedBy?: string | null;
  deletedAt?: Date | null;
  // Join fields
  username?: string;
  userEmail?: string;
  userDisplayName?: string;
  orgUnitName?: string;
  orgUnitCode?: string;
}

export interface IManagerAssignmentInput {
  orgUnitId: string;
  userId: string;
  managerRoleCode: OrgManagerRole;
  isPrimary?: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  assignmentReason?: string | null;
}
