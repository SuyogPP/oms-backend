import { IVendorUser } from './interfaces/vendor-users.interface';
import { VendorUserEntity } from './entities/vendor-users.entity';

export class VendorUsersMapper {
  static toEntity(model: IVendorUser): VendorUserEntity {
    return {
      userId: model.userId,
      employeeId: model.employeeId,
      username: model.username,
      email: model.email,
      userType: model.userType,
      isActive: model.isActive,
            failedLoginCount: model.failedLoginCount,
      lockedUntil: model.lockedUntil,
      status: model.status,
      vendorId: model.vendorId,
      vendorName: model.vendorName,
            createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  static toEntityList(models: IVendorUser[]): VendorUserEntity[] {
    return models.map((m) => this.toEntity(m));
  }
}
