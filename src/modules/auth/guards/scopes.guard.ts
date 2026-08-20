import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPES_KEY } from '../constants/auth.constants';
import { CurrentUser } from '../interfaces/current-user.interface';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUser;

    if (!user || !user.scopes) {
      throw new ForbiddenException(
        'You do not have the required scopes to access this resource.',
      );
    }

    const hasScope = requiredScopes.some((scope) =>
      user.scopes.includes(scope),
    );
    if (!hasScope) {
      throw new ForbiddenException(
        'You do not have the required scopes to access this resource.',
      );
    }

    return true;
  }
}
