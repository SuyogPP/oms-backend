export interface CurrentUser {
  readonly userId: string;
  readonly email: string;
  readonly userType: string;
  readonly roles: string[];
  readonly permissions: string[];
  readonly scopes: string[];
  readonly loginSessionId: string;
}
