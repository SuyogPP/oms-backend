export interface IGradeBenefit {
  salaryGradeId: string;

  deploymentId: string;
  deploymentCode: string;
  deploymentName: string;

  categoryId: string;
  categoryCode: string;
  categoryDetails: string | null;

  designationId: string;
  designationCode: string;
  designationName: string;
  designationSummary: string | null;

  gradeId: string;
  gradeCode: string;
  gradeDetails: string | null;
  minSalary: number | null;
  maxSalary: number | null;

  tierId: string;
  tierCode: string;
  tierDescription: string | null;

  benefitId: string;
  benefitName: string;
  benefitDescription: string | null;

  officeSetup: boolean;

  isActive: string | null;
  isDeleted: boolean;

  createdBy: string;
  createdDate: string;

  modifiedBy: string | null;
  modifiedDate: string | null;
}

export interface IGradeBenefitFilterOptions {
  deploymentId?: string;
  isActive?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface IGradeBenefitCounts {
  total: number;
  active: number;
  inactive: number;
}