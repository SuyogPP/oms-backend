export interface User {
  id: number;

  employeeId: string;

  firstName: string;

  lastName: string;

  email: string;

  phone?: string;

  roleId: number;

  departmentId?: number;

  designationId?: number;

  status: 'ACTIVE' | 'INACTIVE';

  createdAt: Date;

  updatedAt: Date;
}
