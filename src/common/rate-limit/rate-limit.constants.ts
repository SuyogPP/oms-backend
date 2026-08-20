export enum RateLimitTier {
  TIER_1_AUTH_LOGIN = 'TIER_1_AUTH_LOGIN',
  TIER_1_AUTH_REFRESH = 'TIER_1_AUTH_REFRESH',
  TIER_2_SESSION = 'TIER_2_SESSION',
  TIER_3_DASHBOARD = 'TIER_3_DASHBOARD',
  TIER_4_CRUD = 'TIER_4_CRUD',
  TIER_5_SEARCH = 'TIER_5_SEARCH',
  TIER_6_FILE_OPS = 'TIER_6_FILE_OPS',
  TIER_7_REPORTS = 'TIER_7_REPORTS',
  TIER_8_WORKFLOW = 'TIER_8_WORKFLOW',
}

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  description: string;
}

/**
 * 8-Tier Rate Limiting Configuration per Cybersecurity Architecture Doc (Section 11)
 */
export const RATE_LIMIT_TIER_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
  [RateLimitTier.TIER_1_AUTH_LOGIN]: {
    limit: 10,
    windowSeconds: 60,
    description: 'Authentication Login: 10 req/min',
  },
  [RateLimitTier.TIER_1_AUTH_REFRESH]: {
    limit: 30,
    windowSeconds: 60,
    description: 'Authentication Refresh: 30 req/min',
  },
  [RateLimitTier.TIER_2_SESSION]: {
    limit: 20,
    windowSeconds: 60,
    description: 'Session Management: 20 req/min',
  },
  [RateLimitTier.TIER_3_DASHBOARD]: {
    limit: 60,
    windowSeconds: 60,
    description: 'Security & Admin Dashboards: 60 req/min',
  },
  [RateLimitTier.TIER_4_CRUD]: {
    limit: 120,
    windowSeconds: 60,
    description: 'Standard CRUD Operations: 120 req/min',
  },
  [RateLimitTier.TIER_5_SEARCH]: {
    limit: 30,
    windowSeconds: 60,
    description: 'Search & Lookup APIs: 30 req/min',
  },
  [RateLimitTier.TIER_6_FILE_OPS]: {
    limit: 100,
    windowSeconds: 60,
    description: 'File Operations: 100 req/min',
  },
  [RateLimitTier.TIER_7_REPORTS]: {
    limit: 5,
    windowSeconds: 60,
    description: 'Report Generation: 5 req/min',
  },
  [RateLimitTier.TIER_8_WORKFLOW]: {
    limit: 30,
    windowSeconds: 60,
    description: 'Workflow Actions: 30 req/min',
  },
};
