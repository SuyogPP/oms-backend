export interface IDelegation {
  delegationId: string;
  fromUserId: string;
  fromUserName?: string;
  toUserId: string;
  toUserName?: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  isActive: boolean;
  permissionIds?: string[];
  permissionCodes?: string[];
  createdAt: Date;
}

export interface ICreateDelegationData {
  fromUserId: string;
  toUserId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  permissionIds?: string[];
}

export interface IUpdateDelegationData {
  endDate?: Date;
  reason?: string;
  isActive?: boolean;
}
