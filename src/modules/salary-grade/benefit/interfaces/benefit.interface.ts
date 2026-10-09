export interface IBenefit {
  benefitId: string;
  benefitName: string;
  benefitDescription: string | null;

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

export interface IBenefitFilterOptions {
  search?: string;
  isActive?: string;
  page?: number;
  pageSize?: number;
}