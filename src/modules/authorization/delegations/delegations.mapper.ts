import { IDelegation } from './interfaces/delegations.interface';
import { DelegationEntity } from './entities/delegations.entity';

export class DelegationsMapper {
  static toEntity(model: IDelegation): DelegationEntity {
    return { ...model };
  }

  static toEntityList(models: IDelegation[]): DelegationEntity[] {
    return models.map((m) => this.toEntity(m));
  }
}
