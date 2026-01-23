/**
 * Queue Constants for KPATA AI
 * Shared between API (publisher) and Worker (consumer)
 */

export const QUEUE_NAMES = {
  JOBS: 'kpata:jobs',
  NOTIFICATIONS: 'kpata:notifications',
} as const;

export const JOB_PRIORITIES = {
  LOW: 10,    // free users
  NORMAL: 5,  // default
  HIGH: 1,    // pro users
} as const;

export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BACKOFF_DELAYS: [1000, 2000, 5000], // 1s, 2s, 5s
  JITTER_MAX_MS: 500,
} as const;

// Error codes that should NOT be retried
export const NON_RETRYABLE_ERRORS = [
  'BAD_REQUEST',           // 400
  'VALIDATION_FAILED',     // 400
  'NSFW_DETECTED',         // Content policy violation
  'BAD_IMAGE',             // Invalid image format
  'INVALID_INPUT',         // Invalid input data
  'UNAUTHORIZED',          // 401
  'FORBIDDEN',             // 403
] as const;

export type NonRetryableError = typeof NON_RETRYABLE_ERRORS[number];

/**
 * Check if an error code is retryable
 */
export function isRetryableError(errorCode: string): boolean {
  return !NON_RETRYABLE_ERRORS.includes(errorCode as NonRetryableError);
}

/**
 * Get backoff delay with jitter for a given attempt
 */
export function getBackoffDelay(attempt: number): number {
  const baseDelay = RETRY_CONFIG.BACKOFF_DELAYS[attempt - 1] || RETRY_CONFIG.BACKOFF_DELAYS[RETRY_CONFIG.BACKOFF_DELAYS.length - 1];
  const jitter = Math.random() * RETRY_CONFIG.JITTER_MAX_MS;
  return baseDelay + jitter;
}
