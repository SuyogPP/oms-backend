import { Injectable } from '@nestjs/common';
import {
  OrgUnitTypeEntity,
  OrgUnitTypeHierarchyRuleEntity,
} from '../entities/org-unit-type.entity';
import { OrgUnitsMapper } from '../org-units.mapper';
import { OrgUnitTypesRepository } from '../repositories/org-unit-types.repository';

@Injectable()
export class OrgUnitTypesService {
  constructor(
    private readonly typesRepository: OrgUnitTypesRepository,
    private readonly mapper: OrgUnitsMapper,
  ) {}

  /**
   * Retrieves all active organization unit types with their permitted child types.
   */
  async findAllTypes(): Promise<OrgUnitTypeEntity[]> {
    const [types, rules] = await Promise.all([
      this.typesRepository.findAllTypes(),
      this.typesRepository.findAllHierarchyRules(),
    ]);
    return this.mapper.toOrgUnitTypeEntities(types, rules);
  }

  /**
   * Retrieves all active hierarchy relationship rules.
   */
  async findAllHierarchyRules(): Promise<OrgUnitTypeHierarchyRuleEntity[]> {
    const rules = await this.typesRepository.findAllHierarchyRules();
    return this.mapper.toHierarchyRuleEntities(rules);
  }

  /**
   * Retrieves all permitted parent organization unit types for a given child type.
   */
  async findAllowedParents(childTypeId: number): Promise<OrgUnitTypeEntity[]> {
    const allowedParentTypes =
      await this.typesRepository.findAllowedParentTypes(childTypeId);
    return this.mapper.toOrgUnitTypeEntities(allowedParentTypes);
  }
}
