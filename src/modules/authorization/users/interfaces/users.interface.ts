import { UserType, InvitationPurpose } from '../users.constants';

export interface IUser {
  userId: string;
  employeeId?: string | null;
  username: string;
  email: string;
  userType: UserType;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  failedLoginCount: number;
  lastFailedLoginAt?: Date | null;
  lockedUntil?: Date | null;
  adObjectId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProfile {
  userProfileId: string;
  userId: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  jobTitle?: string | null;
  organizationId?: string | null;
  businessUnitId?: string | null;
  departmentId?: string | null;
  sectionId?: string | null;
  vendorId?: string | null;
  mustChangePassword: boolean;
  passwordChangedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export interface IUserWithProfile extends IUser {
  profile?: IUserProfile | null;
  roles?: string[];
  scopes?: string[];
  status?: 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'LOCKED';
}

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

export interface ICreateUserProfileData {
  firstName: string;
  lastName: string;
  displayName?: string;
  phoneNumber?: string;
  jobTitle?: string;
  organizationId?: string;
  businessUnitId?: string;
  departmentId?: string;
  sectionId?: string;
  vendorId?: string;
  createdBy?: string;
}

export interface IUpdateUserProfileData {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phoneNumber?: string;
  jobTitle?: string;
  organizationId?: string | null;
  businessUnitId?: string | null;
  departmentId?: string | null;
  sectionId?: string | null;
  vendorId?: string | null;
  updatedBy?: string;
}

export interface ICreateUserData {
  userId?: string;
  employeeId?: string | null;
  username: string;
  email: string;
  userType: UserType;
  adObjectId?: string | null;
  isActive?: boolean;
  profile?: ICreateUserProfileData;
}

export interface IUpdateUserData {
  employeeId?: string | null;
  email?: string;
  username?: string;
  userType?: UserType;
  profile?: IUpdateUserProfileData;
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
