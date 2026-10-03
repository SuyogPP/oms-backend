import { IUserWithProfile } from './interfaces/users.interface';
import { UserEntity } from './entities/user.entity';

export class UsersMapper {
  static toEntity(model: IUserWithProfile): UserEntity {
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
      firstName: model.firstName,
      lastName: model.lastName,
      mobileNo: model.mobileNo,
      jobTitle: model.jobTitle,
      orgUnitId: model.orgUnitId,
      vendorId: model.vendorId,
      roles: model.roles || [],
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  static toEntityList(models: IUserWithProfile[]): UserEntity[] {
    return models.map((m) => this.toEntity(m));
  }
}
