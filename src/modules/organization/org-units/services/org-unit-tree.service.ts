import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateOrgUnitDto } from '../dto/create-org-unit.dto';
import { MoveOrgUnitDto } from '../dto/move-org-unit.dto';
import { IOrgUnit } from '../interfaces/org-unit.interface';
import { ORG_ERROR_CODES } from '../org-units.constants';
import { OrgUnitChangeLogRepository } from '../repositories/org-unit-change-log.repository';
import { OrgUnitsRepository } from '../repositories/org-units.repository';

@Injectable()
export class OrgUnitTreeService {
  constructor(
    private readonly repository: OrgUnitsRepository,
    private readonly changeLogRepository: OrgUnitChangeLogRepository,
  ) {}

  async createNode(
    dto: CreateOrgUnitDto,
    actorUserId: string,
    parentUnit: IOrgUnit | null,
  ): Promise<IOrgUnit> {
    const isActive = dto.isActive ?? true;
    return this.repository.create({
      unitTypeId: dto.unitTypeId,
      parentId: dto.parentId,
      orgCode: dto.orgCode,
      orgName: dto.orgName,
      costCenterCode: dto.costCenterCode,
      adObjectGuid: dto.adObjectGuid,
      isActive,
    });
  }

  async moveSubtree(
    orgUnitId: number,
    dto: MoveOrgUnitDto,
    actorUserId: string,
  ): Promise<IOrgUnit> {
    const nodeToMove = await this.repository.findById(orgUnitId);
    if (!nodeToMove) {
      throw new HttpException(
        {
          code: ORG_ERROR_CODES.ORG_NOT_FOUND,
          message: `Organization unit [${orgUnitId}] not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const oldParentId = nodeToMove.parentId;

    await this.repository.updateParentAndSubtreeDepth(
      orgUnitId,
      dto.newParentId,
      actorUserId,
    );

    await this.changeLogRepository.create({
      orgUnitId,
      changeType: 'MOVED',
      oldParentId: oldParentId,
      newParentId: dto.newParentId,
      
      reason: dto.reason || 'Structural reorganization move',
      performedBy: actorUserId,
    });

    const updated = await this.repository.findById(orgUnitId);
    return updated!;
  }
}
