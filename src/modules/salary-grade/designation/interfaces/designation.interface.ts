export interface IDesignation {
  designationId: string;
  designationCode: string;
  designationName: string;
  designationSummary: string | null;

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

export interface IDesignationFilterOptions {
  search?: string;
  isActive?: string;
  page?: number;
  pageSize?: number;
}