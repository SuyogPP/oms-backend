export interface ICategory {
  categoryId: string;
  categoryCode: string;
  categoryDetails: string | null;

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

export interface ICategoryFilterOptions {
  search?: string;
  isActive?: string;
  page?: number;
  pageSize?: number;
}