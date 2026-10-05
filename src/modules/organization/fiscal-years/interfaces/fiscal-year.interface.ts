export interface IFiscalYear {
  fiscalYearId: string;
  code: string;
  startDate: string;
  endDate: string;
  status: string;
  oracleBudgetName?: string | null;
  isDelete: boolean;
  createdDate?: string | null;
  createdBy?: string | null;
  modifiedDate?: string | null;
  modifiedBy?: string | null;
  attr1?: string | null;
  attr2?: string | null;
  attr3?: string | null;
  attr4?: string | null;
  attr5?: string | null;
}

export interface ICreateFiscalYearData {
  fiscalYearId?: string;
  code: string;
  startDate: string;
  endDate: string;
  status?: string;
  oracleBudgetName?: string | null;
  isDelete?: boolean;
  createdBy: string;
  modifiedBy?: string;
  attr1?: string;
  attr2?: string;
  attr3?: string;
  attr4?: string;
  attr5?: string;
}

export interface IUpdateFiscalYearData {
  fiscalYearId?: string;
  code?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  oracleBudgetName?: string | null;
  isDelete?: boolean;
  createdBy?: string;
  modifiedBy?: string;
  /** Internal: reactivating a soft-deleted record via POST */
  reactivate?: boolean;
  attr1?: string;
  attr2?: string;
  attr3?: string;
  attr4?: string;
  attr5?: string;
}

export interface IFiscalYearFilterOptions {
  search?: string;
  includeInactive?: boolean;
}
