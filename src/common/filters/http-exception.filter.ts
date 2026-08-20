import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ErrorEnvelope,
  ResponseMeta,
} from '../interfaces/response-envelope.interface';
import { RequestContextService } from '../services/request-context.service';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  constructor(private readonly requestContextService: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        errorCode = this.getErrorCodeFromStatus(status);
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as any;
        message = resObj.message || exception.message || 'Request failed';
        errorCode =
          resObj.error || resObj.code || this.getErrorCodeFromStatus(status);

        // Handle class-validator validation pipe errors
        if (Array.isArray(resObj.message)) {
          errorCode = 'VALIDATION_ERROR';
          message = 'Validation failed';
          details = resObj.message;
        } else if (resObj.details) {
          details = resObj.details;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled Exception: ${exception.message}`,
        exception.stack,
      );
    }

    const correlationId = this.requestContextService.getCorrelationId();
    const durationMs = this.requestContextService.getDurationMs();

    const meta: ResponseMeta = {
      correlationId,
      timestamp: new Date().toISOString(),
      durationMs,
      path: request.originalUrl || request.url,
    };

    const errorResponse: ErrorEnvelope = {
      success: false,
      error: {
        code:
          typeof errorCode === 'string'
            ? errorCode.toUpperCase().replace(/\s+/g, '_')
            : 'ERROR',
        message: Array.isArray(message) ? message.join(', ') : message,
        details: details ?? null,
      },
      meta,
    };

    response.status(status).json(errorResponse);
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
