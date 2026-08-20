/**
 * Injection token for pluggable reference check registry (§7.5).
 * Downstream domains (e.g. Budget, Requisition) register implementations
 * with this token to guard deletion and moves without coupling to this module.
 */
export const ORG_UNIT_REFERENCE_CHECKS = 'ORG_UNIT_REFERENCE_CHECKS';

export interface OrgUnitReferenceCheck {
  readonly name: string; // e.g. 'BUDGET' | 'REQUISITION' | 'USERS'
  countReferences(orgUnitIds: string[]): Promise<number>;
  readonly blocksDelete: boolean;
  readonly blocksMove: boolean;
}
