export interface IDeploymentModel {
  deploymentId: string;
  deploymentCode: string;
  deploymentName: string;
  workSettings: string | null;

  attr1: string | null;
  attr2: string | null;
  attr3: string | null;
  attr4: string | null;
  attr5: string | null;

  isActive: string | null;
  isDeleted: boolean;

  createdBy: string;
  createdDate: string;

  modifiedBy: string | null;
  modifiedDate: string | null;
}

export interface IDeploymentModelFilterOptions {
  search?: string;
  isActive?: string;
}