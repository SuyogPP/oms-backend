import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import {
  RequestContextService,
  RequestContextStore,
} from '../services/request-context.service';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const headerCorrelationId = req.headers['x-correlation-id'] as string;
    const correlationId = headerCorrelationId || crypto.randomUUID();

    // Ensure correlation ID is set on response header
    res.setHeader('x-correlation-id', correlationId);

    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      '0.0.0.0';

    const userAgent = (req.headers['user-agent'] as string) || 'UNKNOWN';

    const userId = (req.headers['x-user-id'] as string) || null;
    const loginSessionId =
      (req.headers['x-login-session-id'] as string) || null;

    const store: RequestContextStore = {
      correlationId,
      startTime: Date.now(),
      ipAddress,
      userAgent,
      path: req.originalUrl || req.url,
      method: req.method,
      deviceFingerprint:
        (req.headers['x-device-fingerprint'] as string) || userAgent,
      loginSessionId,
      user: userId
        ? {
            userId,
            email: (req.headers['x-user-email'] as string) || '',
            userType: (req.headers['x-user-type'] as string) || 'User',
            roles: ((req.headers['x-roles'] as string) || '')
              .split(',')
              .filter(Boolean),
            permissions: ((req.headers['x-permissions'] as string) || '')
              .split(',')
              .filter(Boolean),
            scopes: ((req.headers['x-scopes'] as string) || '')
              .split(',')
              .filter(Boolean),
            loginSessionId: loginSessionId || '',
          }
        : null,
    };

    RequestContextService.run(store, () => {
      next();
    });
  }
}
