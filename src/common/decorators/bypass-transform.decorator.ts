import { SetMetadata } from '@nestjs/common';

export const BYPASS_TRANSFORM_KEY = 'BYPASS_TRANSFORM';

/**
 * Decorator to bypass the global response transformation envelope.
 * Useful for endpoints that stream data, return raw files, or have custom responses.
 */
export const BypassTransform = () => SetMetadata(BYPASS_TRANSFORM_KEY, true);
