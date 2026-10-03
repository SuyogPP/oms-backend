import { UserType, InvitationPurpose } from '../users.constants';

export interface IUser {
  userId: string;
  employeeId?: string | null;
  username: string;
  email: string;
  userType: UserType;
  isActive: boolean;
  failedLoginCount: number;
  lockedUntil?: Date | null;
  adObjectId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  mobileNo?: string | null;
  jobTitle?: string | null;
  orgUnitId?: string | null;
  vendorId?: number | null;
  roles?: string[];
  scopes?: string[];
  status?: 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'LOCKED';
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserWithProfile extends IUser {}

export interface IUserInvitation {
  invitationId: string;
  userId: string;
  tokenHash: string;
  purpose: InvitationPurpose;
  expiresAt: Date;
  consumedAt?: Date | null;
  createdAt: Date;
  createdBy?: string | null;
}

export interface IPasswordHistory {
  passwordHistoryId: string;
  userId: string;
  passwordHash: string;
  changedAt: Date;
}

export interface ICreateUserData {
  userId?: string;
  employeeId?: string | null;
  username: string;
  email: string;
  userType: UserType;
  adObjectId?: string | null;
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
  mobileNo?: string;
  jobTitle?: string;
  orgUnitId?: string;
  vendorId?: number;
}

export interface IUpdateUserData {
  employeeId?: string | null;
  email?: string;
  username?: string;
  userType?: UserType;
  firstName?: string;
  lastName?: string;
  mobileNo?: string;
  jobTitle?: string;
  orgUnitId?: string;
  vendorId?: number;
}

export interface IUserFilterOptions {
  search?: string;
  userType?: UserType;
  status?: 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'LOCKED';
  departmentId?: string;
  businessUnitId?: string;
  organizationId?: string;
  vendorId?: string;
  role?: string;
  hasNoRole?: boolean;
  isLocked?: boolean;
  requesterUserId?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface IUserListResult {
  items: IUserWithProfile[];
  total: number;
  page: number;
  pageSize?: number;
  limit: number;
  totalPages: number;
}
