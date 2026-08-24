import { ApiProperty } from '@nestjs/swagger';
import { IUserProfile, IUserWithProfile, IUserListResult } from '../interfaces/users.interface';
import type { UserType } from '../users.constants';

export class UserProfileEntity implements IUserProfile {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userProfileId!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userId!: string;

  @ApiProperty({ example: 'Tariq' })
  firstName!: string;

  @ApiProperty({ example: 'Al Hashimi' })
  lastName!: string;

  @ApiProperty({ example: 'Tariq Al Hashimi', required: false })
  displayName?: string | null;

  @ApiProperty({ example: '+971501234567', required: false })
  phoneNumber?: string | null;

  @ApiProperty({ example: 'Finance Director', required: false })
  jobTitle?: string | null;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  organizationId?: string | null;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  businessUnitId?: string | null;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  departmentId?: string | null;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122', required: false })
  sectionId?: string | null;

  @ApiProperty({ example: null, required: false })
  vendorId?: string | null;

  @ApiProperty({ example: false })
  mustChangePassword!: boolean;

  @ApiProperty({ example: '2026-08-20T10:00:00.000Z', required: false })
  passwordChangedAt?: Date | null;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-22T00:00:00.000Z' })
  updatedAt!: Date;
}

export class UserEntity implements IUserWithProfile {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userId!: string;

  @ApiProperty({ example: 'EMP-0042', required: false })
  employeeId?: string | null;

  @ApiProperty({ example: 'tariq.hashimi' })
  username!: string;

  @ApiProperty({ example: 'tariq.hashimi@diez.ae' })
  email!: string;

  @ApiProperty({ example: 'INTERNAL', enum: ['INTERNAL', 'VENDOR', 'SYSTEM', 'SERVICE_ACCOUNT'] })
  userType!: UserType;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: false })
  isDeleted!: boolean;

  @ApiProperty({ example: 0 })
  failedLoginCount!: number;

  @ApiProperty({ example: null, required: false })
  lockedUntil?: Date | null;

  @ApiProperty({ example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE', 'INVITED', 'LOCKED'] })
  status?: 'ACTIVE' | 'INACTIVE' | 'INVITED' | 'LOCKED';

  @ApiProperty({ type: UserProfileEntity, required: false })
  profile?: UserProfileEntity | null;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-22T00:00:00.000Z' })
  updatedAt!: Date;
}

export class UserListResponseEntity implements IUserListResult {
  @ApiProperty({ type: [UserEntity] })
  items!: UserEntity[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class UserActivityEntity {
  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  eventId!: string;

  @ApiProperty({ example: '1053433E-F36B-1410-85ED-009A959FB122' })
  userId!: string;

  @ApiProperty({ example: 'USER_DEACTIVATED' })
  eventType!: string;

  @ApiProperty({ example: 'User account deactivated by admin' })
  description!: string;

  @ApiProperty({ example: '192.168.1.1' })
  ipAddress!: string;

  @ApiProperty({ example: 'Mozilla/5.0...' })
  userAgent!: string;

  @ApiProperty({ example: '2026-08-24T12:00:00.000Z' })
  createdAt!: Date;
}
