import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

// Org Units
import { OrgUnitsController } from './org-units/controllers/org-units.controller';
import { OrgUnitTypesController } from './org-units/controllers/org-unit-types.controller';
import { OrgUnitsService } from './org-units/services/org-units.service';
import { OrgUnitTreeService } from './org-units/services/org-unit-tree.service';
import { OrgUnitValidationService } from './org-units/services/org-unit-validation.service';
import { OrgUnitTypesService } from './org-units/services/org-unit-types.service';
import { OrgUnitsRepository } from './org-units/repositories/org-units.repository';
import { OrgUnitClosureRepository } from './org-units/repositories/org-unit-closure.repository';
import { OrgUnitTypesRepository } from './org-units/repositories/org-unit-types.repository';
import { OrgUnitChangeLogRepository } from './org-units/repositories/org-unit-change-log.repository';
import { OrgUnitsMapper } from './org-units/org-units.mapper';
import { ORG_UNIT_REFERENCE_CHECKS } from './org-units/interfaces/org-unit-reference-check.interface';

// Org Managers
import { OrgManagersController } from './org-managers/controllers/org-managers.controller';
import { OrgManagersService } from './org-managers/services/org-managers.service';
import { OrgManagersRepository } from './org-managers/repositories/org-managers.repository';
import { OrgManagersMapper } from './org-managers/org-managers.mapper';

// Org Scope
import { OrgScopeResolverService } from './org-scope/services/org-scope-resolver.service';
import { OrgScopeRepository } from './org-scope/repositories/org-scope.repository';
import { InternalUserGuard } from './org-scope/guards/internal-user.guard';

/**
 * Domain 2 — Organization Structure Module
 *
 * Encapsulates Org Units tree, Types & Hierarchy rules, Closure & Materialized Path maintenance,
 * Manager assignments, Change logging, Reference-check registry, and Layer 3 Scope resolution.
 */
@Module({
  imports: [forwardRef(() => AuthModule), AuditModule],
  controllers: [
    OrgUnitsController,
    OrgUnitTypesController,
    OrgManagersController,
  ],
  providers: [
    // Guards
    InternalUserGuard,

    // Mappers
    OrgUnitsMapper,
    OrgManagersMapper,

    // Repositories
    OrgUnitsRepository,
    OrgUnitClosureRepository,
    OrgUnitTypesRepository,
    OrgUnitChangeLogRepository,
    OrgManagersRepository,
    OrgScopeRepository,

    // Services
    OrgUnitsService,
    OrgUnitTreeService,
    OrgUnitValidationService,
    OrgUnitTypesService,
    OrgManagersService,
    OrgScopeResolverService,

    // Reference Checks Registry (multi-provider injection token)
    {
      provide: ORG_UNIT_REFERENCE_CHECKS,
      useValue: [],
    },
  ],
  exports: [
    OrgUnitsService,
    OrgUnitTreeService,
    OrgManagersService,
    OrgScopeResolverService,
    InternalUserGuard,
    ORG_UNIT_REFERENCE_CHECKS,
  ],
})
export class OrganizationModule {}
