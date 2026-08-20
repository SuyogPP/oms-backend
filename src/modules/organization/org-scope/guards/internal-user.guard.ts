import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

/**
 * InternalUserGuard
 *
 * Section 9.3 Non-Negotiable #4:
 * Outright rejects VENDOR and external users on all /api/v1/organization/* routes.
 * Only INTERNAL users with authenticated active accounts may access organization structure APIs.
 */
@Injectable()
export class InternalUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.userType !== 'INTERNAL') {
      throw new HttpException(
        {
          code: 'ORG_VENDOR_ACCESS_DENIED',
          message:
            'Access denied: Vendor and external accounts are not permitted to access organization structure endpoints.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
