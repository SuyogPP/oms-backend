import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditService } from '../service/audit.services';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    constructor(
        private readonly auditService: AuditService,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const startedAt = Date.now();

        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        return next.handle().pipe(
            tap(async () => {
                await this.writeAuditLog(request, response, startedAt, true);
            }),
            catchError((error) => {
                this.writeAuditLog(request, response, startedAt, false, error);
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
        console.log('========================');
console.log('AUDIT INTERCEPTOR HIT');
console.log(request.method);
console.log(request.originalUrl);
console.log('========================');
        try {
            const method = request.method;
            const endpoint = request.originalUrl || request.url;
            const ipAddress =
                request.headers['x-forwarded-for'] ||
                request.ip ||
                request.socket?.remoteAddress ||
                '0.0.0.0';

            const userAgentRaw = request.headers['user-agent'] || null;

            const deviceFingerprint =
                userAgentRaw || `${ipAddress}-${request.headers['accept-language'] || 'unknown'}`;

            const statusCode = response.statusCode || (isSuccess ? 200 : 500);
            console.log("🚀 ~ AuditInterceptor ~ writeAuditLog ~ statusCode:", statusCode)

            await this.auditService.logApiCall({
                sessionId: null,
                deviceFingerprint,
                ipAddress,
                deviceType: 'UNKNOWN',
                browserName: null,
                osName: null,
                userAgentRaw,

                userId: request.headers['x-user-id'] || null,
                username: null,

                httpMethod: method,
                endpoint,
                controllerName: contextControllerName(request),
                actionName: null,

                authEventType: getAuthEventType(method, endpoint),

                targetUserId: null,
                httpStatusCode: statusCode,
                isSuccess,
                failureReason: isSuccess ? null : error?.message || 'Request failed',
            });
        } catch (auditError) {
            console.error('Audit logging failed:', auditError);
        }
    }
}

function getAuthEventType(method: string, endpoint: string): string {
    if (method === 'POST' && endpoint.includes('/authorization/users')) {
        return 'USER_CREATED';
    }

    if (method === 'DELETE' && endpoint.includes('/authorization/users')) {
        return 'USER_DELETED';
    }

    return 'AUTH_API_CALL';
}

function contextControllerName(request: any): string | null {
    return request.route?.path ? 'UsersController' : null;
}