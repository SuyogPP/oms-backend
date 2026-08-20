import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { SecurityEventsService } from '../../modules/security-events/services/security-events.service';
import { RequestContextService } from '../services/request-context.service';
import { RATE_LIMIT_TIER_CONFIGS, RateLimitTier } from './rate-limit.constants';
import {
  RATE_LIMIT_TIER_KEY,
  SKIP_RATE_LIMIT_KEY,
} from './rate-limit.decorator';

interface RateLimitRecord {
  timestamps: number[];
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private static readonly storage = new Map<string, RateLimitRecord>();

  constructor(
    private readonly reflector: Reflector,
    private readonly requestContextService: RequestContextService,
    private readonly securityEventsService: SecurityEventsService,
  ) {
    // Periodic cleanup of stale records every 5 minutes
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of RateLimitGuard.storage.entries()) {
        // remove timestamps older than 2 minutes
        record.timestamps = record.timestamps.filter((ts) => now - ts < 120000);
        if (record.timestamps.length === 0) {
          RateLimitGuard.storage.delete(key);
        }
      }
    }, 300000);
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isSkipped = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isSkipped) {
      return true;
    }

    const tier =
      this.reflector.getAllAndOverride<RateLimitTier>(RATE_LIMIT_TIER_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || RateLimitTier.TIER_4_CRUD;

    const config = RATE_LIMIT_TIER_CONFIGS[tier];
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    const userId = this.requestContextService.getUserId();
    const ipAddress = this.requestContextService.getIpAddress();
    const identifier = userId ? `user:${userId}` : `ip:${ipAddress}`;
    const storageKey = `${identifier}:${tier}`;

    let record = RateLimitGuard.storage.get(storageKey);
    if (!record) {
      record = { timestamps: [] };
      RateLimitGuard.storage.set(storageKey, record);
    }

    // Filter out timestamps outside current window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    const currentCount = record.timestamps.length;
    const remaining = Math.max(0, config.limit - currentCount - 1);
    const oldestTimestamp = record.timestamps[0] || now;
    const resetSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    const response = context.switchToHttp().getResponse<Response>();
    if (response && response.setHeader) {
      response.setHeader('X-RateLimit-Limit', config.limit);
      response.setHeader('X-RateLimit-Remaining', remaining);
      response.setHeader('X-RateLimit-Reset', Math.max(1, resetSeconds));
    }

    if (currentCount >= config.limit) {
      this.logger.warn(
        `Rate limit exceeded for [${storageKey}] on tier [${tier}] (${config.limit} req / ${config.windowSeconds}s)`,
      );

      // Log security event asynchronously
      this.securityEventsService
        .log('RATE_LIMIT_EXCEEDED', {
          description: `Exceeded ${config.description} on ${this.requestContextService.getPath()}`,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to log RATE_LIMIT_EXCEEDED security event: ${err.message}`,
          );
        });

      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Limit is ${config.limit} requests per ${config.windowSeconds} seconds.`,
          details: {
            tier,
            limit: config.limit,
            windowSeconds: config.windowSeconds,
            retryAfterSeconds: Math.max(1, resetSeconds),
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.timestamps.push(now);
    return true;
  }
}
