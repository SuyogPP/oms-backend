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
      isDeleted: model.isDeleted,
      failedLoginCount: model.failedLoginCount,
      lockedUntil: model.lockedUntil,
      status: model.status,
      profile: model.profile ? { ...model.profile } : null,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  static toEntityList(models: IUserWithProfile[]): UserEntity[] {
    return models.map((m) => this.toEntity(m));
  }
}
