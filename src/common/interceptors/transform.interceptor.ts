import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BYPASS_TRANSFORM_KEY } from '../decorators/bypass-transform.decorator';
import { PaginatedResult } from '../dto/pagination.dto';
import {
  ResponseEnvelope,
  ResponseMeta,
} from '../interfaces/response-envelope.interface';
import { RequestContextService } from '../services/request-context.service';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ResponseEnvelope<T> | T
> {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContextService: RequestContextService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<T> | T> {
    const bypass = this.reflector.getAllAndOverride<boolean>(
      BYPASS_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (bypass) {
      return next.handle();
    }

    const correlationId = this.requestContextService.getCorrelationId();
    const durationMs = this.requestContextService.getDurationMs();
    const path = this.requestContextService.getPath();

    return next.handle().pipe(
      map((data) => {
        // If data is already enveloped, return as is
        if (
          data &&
          typeof data === 'object' &&
          data.success === true &&
          'meta' in data
        ) {
          return data;
        }

        const meta: ResponseMeta = {
          correlationId,
          timestamp: new Date().toISOString(),
          durationMs,
          path,
        };

        // Check if result is a PaginatedResult
        if (
          data instanceof PaginatedResult ||
          (data &&
            typeof data === 'object' &&
            'items' in data &&
            'pagination' in data)
        ) {
          meta.pagination = data.pagination;
          return {
            success: true,
            data: data.items,
            meta,
          };
        }

        return {
          success: true,
          data: data ?? null,
          meta,
        };
      }),
    );
  }
}
