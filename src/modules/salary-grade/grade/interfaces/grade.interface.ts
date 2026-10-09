export interface IGrade {
  gradeId: string;
  gradeCode: string;
  gradeDetails: string | null;

  minSalary: number | null;
  maxSalary: number | null;

  attr1: string | null;
  attr2: string | null;
  attr3: string | null;
  attr4: string | null;
  attr5: string | null;

  isActive: string | null;
  isDelete: boolean;

  createdBy: string;
  createdDate: string;

  modifiedBy: string | null;
  modifiedDate: string | null;
}

export interface IGradeFilterOptions {
  search?: string;
  isActive?: string;
  page?: number;
  pageSize?: number;
}