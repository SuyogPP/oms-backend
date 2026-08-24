import { IUserWithProfile } from '../../users/interfaces/users.interface';

export interface IVendorUser extends IUserWithProfile {
  vendorId: string;
  vendorName?: string;
}

export interface ICreateVendorUserData {
  username: string;
  email: string;
  vendorId: string;
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
