import { RetryStrategy } from '@prisma/client';

export interface RetryPolicyConfig {
  strategy: RetryStrategy;
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  backoffFactor?: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicyConfig = {
  strategy: 'EXPONENTIAL',
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  maxAttempts: 3,
  backoffFactor: 2.0,
};

/**
 * Calculates backoff delay in milliseconds based on attempt number and policy configuration.
 *
 * FIXED:
 *   delay = baseDelay
 * LINEAR:
 *   delay = baseDelay * attempt
 * EXPONENTIAL:
 *   delay = baseDelay * (backoffFactor ^ (attempt - 1))
 *
 * Result is capped at maxDelayMs.
 */
export function calculateBackoffDelay(
  attempt: number,
  policy: RetryPolicyConfig = DEFAULT_RETRY_POLICY
): number {
  if (attempt <= 0) {
    return 0;
  }

  const baseDelay = Math.max(0, policy.baseDelayMs);
  const factor = policy.backoffFactor !== undefined && policy.backoffFactor > 0 ? policy.backoffFactor : 2.0;
  let delay = baseDelay;

  switch (policy.strategy) {
    case 'FIXED':
      delay = baseDelay;
      break;

    case 'LINEAR':
      delay = baseDelay * attempt;
      break;

    case 'EXPONENTIAL':
      // For attempt 1: baseDelay * 2^0 = baseDelay
      // For attempt 2: baseDelay * 2^1 = baseDelay * 2
      // For attempt 3: baseDelay * 2^2 = baseDelay * 4
      delay = baseDelay * Math.pow(factor, attempt - 1);
      break;

    default:
      delay = baseDelay * Math.pow(2, attempt - 1);
      break;
  }

  return Math.min(Math.floor(delay), policy.maxDelayMs);
}

/**
 * Determines whether a job can be retried.
 */
export function canRetryJob(
  currentAttempt: number,
  maxAttempts: number = DEFAULT_RETRY_POLICY.maxAttempts
): boolean {
  return currentAttempt < maxAttempts;
}

/**
 * Calculates the next retry timestamp for a failed job.
 */
export function getNextRetryDate(
  attempt: number,
  policy: RetryPolicyConfig = DEFAULT_RETRY_POLICY,
  now: Date = new Date()
): Date {
  const delayMs = calculateBackoffDelay(attempt, policy);
  return new Date(now.getTime() + delayMs);
}
