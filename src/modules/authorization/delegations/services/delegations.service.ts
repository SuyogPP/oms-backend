import { Injectable, NotImplementedException } from '@nestjs/common';
import { DelegationsRepository } from '../repositories/delegations.repository';
import { CreateDelegationDto, UpdateDelegationDto } from '../dto/create-delegation.dto';
import { IDelegation } from '../interfaces/delegations.interface';

@Injectable()
export class DelegationsService {
  constructor(private readonly delegationsRepository: DelegationsRepository) {}

  async findByUserId(userId: string, requesterUserId?: string): Promise<IDelegation[]> {
    throw new NotImplementedException('DelegationsService.findByUserId is not yet implemented');
  }

  async findMyDelegations(userId: string): Promise<IDelegation[]> {
    throw new NotImplementedException('DelegationsService.findMyDelegations is not yet implemented');
  }

  async create(fromUserId: string, dto: CreateDelegationDto, operatorUserId?: string): Promise<IDelegation> {
    throw new NotImplementedException('DelegationsService.create is not yet implemented');
  }

  async update(delegationId: string, dto: UpdateDelegationDto, operatorUserId?: string): Promise<IDelegation> {
    throw new NotImplementedException('DelegationsService.update is not yet implemented');
  }

  async cancel(delegationId: string, operatorUserId?: string): Promise<void> {
    throw new NotImplementedException('DelegationsService.cancel is not yet implemented');
  }
}
