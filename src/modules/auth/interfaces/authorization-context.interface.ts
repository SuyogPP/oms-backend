export interface AuthorizationContext {
  userId: string;

  loginSessionId: string;

  email: string;

  userType: string;

  roles: string[];

  permissions: string[];

  scopes: string[];
}
