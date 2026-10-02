export interface IBudgetCategory {
  budgetCategoryId: string;
  code: string;
  name: string;
  expenseType: string;
  oracleAccountCode?: string | null;
  isActive: boolean;
}

export interface ICreateBudgetCategoryData {
  budgetCategoryId?: string;
  code: string;
  name: string;
  expenseType: string;
  oracleAccountCode?: string | null;
  isActive?: boolean;
}

export interface IUpdateBudgetCategoryData {
  code?: string;
  name?: string;
  expenseType?: string;
  oracleAccountCode?: string | null;
  isActive?: boolean;
}

export interface IBudgetCategoryFilterOptions {
  search?: string;
  includeInactive?: boolean;
}
