import { IUserWithProfile } from '../../users/interfaces/users.interface';

export interface IVendorUser extends IUserWithProfile {
  vendorId: number;
  vendorName?: string;
}

export interface ICreateVendorUserData {
  username: string;
  email: string;
  vendorId: number;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  jobTitle?: string;
}

export interface IUpdateVendorUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  jobTitle?: string;
}
