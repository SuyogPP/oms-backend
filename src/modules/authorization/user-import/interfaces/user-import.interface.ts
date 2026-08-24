export interface IUserImportRow {
  rowNumber: number;
  employeeId?: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  departmentCode?: string;
  roles?: string[];
  scopeCode?: string;
  scopeUnitCode?: string;
}

export interface IRowValidationError {
  rowNumber: number;
  field: string;
  errorCode: string;
  message: string;
}

export interface IImportValidationResult {
  importToken: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: IRowValidationError[];
}

export interface IImportCommitResult {
  importedCount: number;
  failedCount: number;
  createdUserIds: string[];
}
