import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestContextService } from '../services/request-context.service';

@Injectable()
export class RequestMetadataInterceptor implements NestInterceptor {
  constructor(private readonly requestContextService: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    const correlationId = this.requestContextService.getCorrelationId();

    if (response && response.setHeader && !response.headersSent) {
      response.setHeader('x-correlation-id', correlationId);
    }

    return next.handle().pipe(
      tap(() => {
        const durationMs = this.requestContextService.getDurationMs();
        if (response && response.setHeader && !response.headersSent) {
          response.setHeader('x-response-time', `${durationMs}ms`);
        }
      }),
    );
  }
}
