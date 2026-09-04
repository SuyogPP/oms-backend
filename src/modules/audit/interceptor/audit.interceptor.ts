import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { RequestContextService } from '../../../common/services/request-context.service';
import { AUDIT_IGNORE_KEY } from '../decorators/audit-ignore.decorator';
import { AuditService } from '../service/audit.services';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
    private readonly requestContextService: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isIgnored = this.reflector.getAllAndOverride<boolean>(
      AUDIT_IGNORE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isIgnored) {
      return next.handle();
    }

    const startedAt = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap(() => {
        this.writeAuditLog(request, response, startedAt, true).catch(() => {});
      }),
      catchError((error) => {
        this.writeAuditLog(request, response, startedAt, false, error).catch(
          () => {},
        );
        return throwError(() => error);
      }),
    );
  }

  private async writeAuditLog(
    request: any,
    response: any,
    startedAt: number,
    isSuccess: boolean,
    error?: any,
  ) {
    try {
      const method = request.method || this.requestContextService.getMethod();
      const endpoint =
        request.originalUrl ||
        request.url ||
        this.requestContextService.getPath();
      const ipAddress = this.requestContextService.getIpAddress();
      const userAgentRaw = this.requestContextService.getUserAgent();
      const deviceFingerprint =
        this.requestContextService.getDeviceFingerprint();
      const userId =
        this.requestContextService.getUserId() ||
        request.headers?.['x-user-id'] ||
        null;
      const loginSessionId = this.requestContextService.getLoginSessionId();
      const statusCode =
        response.statusCode || (isSuccess ? 200 : error?.status || 500);

      await this.auditService.logApiCall({
        sessionId: loginSessionId,
        deviceFingerprint,
        ipAddress,
        deviceType: 'UNKNOWN',
        browserName: null,
        osName: null,
        userAgentRaw,
        userId,
        username: null,
        httpMethod: method,
        endpoint,
        controllerName: this.getControllerName(request),
        actionName: null,
        authEventType: this.getAuthEventType(method, endpoint),
        targetUserId: null,
        httpStatusCode: statusCode,
        isSuccess,
        failureReason: isSuccess ? null : error?.message || 'Request failed',
      });
    } catch (auditError) {
      this.logger.error('Audit logging failed:', (auditError as Error).message);
    }
  }

  private getAuthEventType(method: string, endpoint: string): string {
    if (method === 'POST' && endpoint.includes('/authorization/users')) {
      return 'USER_CREATED';
    }
    if (method === 'DELETE' && endpoint.includes('/authorization/users')) {
      return 'USER_DELETED';
    }
    if (endpoint.includes('/auth/login')) {
      return 'LOGIN_ATTEMPT';
    }
    if (endpoint.includes('/auth/logout')) {
      return 'LOGOUT_ATTEMPT';
    }
    return 'AUTH_API_CALL';
  }

  private getControllerName(request: any): string | null {
    return request.route?.path ? 'ApiController' : null;
  }
}
