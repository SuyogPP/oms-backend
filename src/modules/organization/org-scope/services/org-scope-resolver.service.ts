import { Injectable } from '@nestjs/common';
import {
  IUserOrgScope,
  IVisibleOrgUnitResult,
} from '../interfaces/org-scope.interface';
import { OrgScopeRepository } from '../repositories/org-scope.repository';

/**
 * OrgScopeResolverService
 *
 * Layer 3 Scope Authorization Resolver.
 * Resolves user organization scopes and visible subtrees via org.fn_VisibleOrgUnits.
 */
@Injectable()
export class OrgScopeResolverService {
  constructor(private readonly scopeRepository: OrgScopeRepository) {}

  /**
   * Retrieves user scope assignments.
   */
  async getUserScopes(userId: string): Promise<IUserOrgScope[]> {
    return this.scopeRepository.getUserScopes(userId);
  }

  /**
   * Returns list of visible OrgUnitIds for the user.
   */
  async getVisibleOrgUnitIds(userId: string): Promise<string[]> {
    return this.scopeRepository.getVisibleOrgUnitIds(userId);
  }

  /**
   * Returns list of visible organization units for the user.
   */
  async getVisibleOrgUnits(userId: string): Promise<IVisibleOrgUnitResult[]> {
    return this.scopeRepository.getVisibleOrgUnits(userId);
  }

  /**
   * Checks whether a specific org unit is within the user's visible scope.
   */
  async isOrgUnitVisible(userId: string, orgUnitId: string): Promise<boolean> {
    return this.scopeRepository.isOrgUnitVisible(userId, orgUnitId);
  }
}
