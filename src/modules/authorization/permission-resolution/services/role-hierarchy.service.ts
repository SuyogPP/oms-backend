import { Injectable, Logger } from '@nestjs/common';
import { PermissionResolutionRepository } from '../repositories/permission-resolution.repository';
import { RoleResolutionItem } from '../interfaces/permission-resolution.interface';

@Injectable()
export class RoleHierarchyService {
  private readonly logger = new Logger(RoleHierarchyService.name);

  constructor(
    private readonly repository: PermissionResolutionRepository,
  ) {}

  /**
   * Resolves direct and transitive child roles conferred by the user's active direct roles.
   * Leverages the cycle-guarded recursive CTE.
   */
  async resolveActiveRolesForUser(
    userId: string,
  ): Promise<RoleResolutionItem[]> {
    return this.repository.resolveUserRolesWithHierarchy(userId);
  }
}
