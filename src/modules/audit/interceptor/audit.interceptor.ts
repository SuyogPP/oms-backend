import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditRepository } from '../repositories/audit.repository';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    constructor(
        private readonly auditRepository: AuditRepository,
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

            const deviceId = await this.auditRepository.ensureDevice({
                deviceFingerprint,
                ipAddress,
                deviceType: 'UNKNOWN',
                browserName: null,
                osName: null,
                userAgentRaw,
            });

            const statusCode = response.statusCode || (isSuccess ? 200 : 500);

            await this.auditRepository.logAuthApiCall({
                sessionId: null,
                deviceId,
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