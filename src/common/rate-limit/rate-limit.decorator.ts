import { SetMetadata } from '@nestjs/common';
import { RateLimitTier } from './rate-limit.constants';

export const RATE_LIMIT_TIER_KEY = 'RATE_LIMIT_TIER';
export const SKIP_RATE_LIMIT_KEY = 'SKIP_RATE_LIMIT';

/**
 * Decorator to assign a specific rate limiting tier to an endpoint or controller.
 */
export const RateLimit = (tier: RateLimitTier) =>
  SetMetadata(RATE_LIMIT_TIER_KEY, tier);

/**
 * Decorator to skip rate limiting on a specific endpoint.
 */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
