export interface IUserOrgScope {
  userOrganizationScopeId: string;
  userId: string;
  scopeDefinitionId: string;
  scopeCode?: string;
  scopeName?: string;
  orgUnitId: string | null;
  organizationId: string | null;
  businessUnitId: string | null;
  departmentId: string | null;
  sectionId: string | null;
}

export interface IVisibleOrgUnitResult {
  orgUnitId: string;
  code?: string;
  name?: string;
  orgUnitTypeId?: number;
}
