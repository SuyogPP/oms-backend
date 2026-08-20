/**
 * Represents metadata associated with an API response.
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ResponseMeta {
  correlationId?: string;
  timestamp: string;
  durationMs?: number;
  path?: string;
  pagination?: PaginationMeta;
  [key: string]: any;
}

/**
 * Standard success response envelope for all API responses.
 */
export interface ResponseEnvelope<T = any> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

/**
 * Standard error response structure.
 */
export interface ErrorDetail {
  code: string;
  message: string;
  details?: string[] | Record<string, any> | null;
}

/**
 * Standard error response envelope for all API exceptions.
 */
export interface ErrorEnvelope {
  success: false;
  error: ErrorDetail;
  meta: ResponseMeta;
}
