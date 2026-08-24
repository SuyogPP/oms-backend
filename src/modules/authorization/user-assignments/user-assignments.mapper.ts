import {
  IUserRoleAssignment,
  IUserScopeAssignment,
  IUserOverrideAssignment,
} from './interfaces/user-assignments.interface';
import {
  UserRoleEntity,
  UserScopeEntity,
  UserOverrideEntity,
} from './entities/user-assignments.entity';

export class UserAssignmentsMapper {
  static toRoleEntity(model: IUserRoleAssignment): UserRoleEntity {
    return { ...model };
  }

  static toRoleEntityList(models: IUserRoleAssignment[]): UserRoleEntity[] {
    return models.map((m) => this.toRoleEntity(m));
  }

  static toScopeEntity(model: IUserScopeAssignment): UserScopeEntity {
    return { ...model };
  }

  static toScopeEntityList(models: IUserScopeAssignment[]): UserScopeEntity[] {
    return models.map((m) => this.toScopeEntity(m));
  }

  static toOverrideEntity(model: IUserOverrideAssignment): UserOverrideEntity {
    return { ...model };
  }

  static toOverrideEntityList(
    models: IUserOverrideAssignment[],
  ): UserOverrideEntity[] {
    return models.map((m) => this.toOverrideEntity(m));
  }
}
