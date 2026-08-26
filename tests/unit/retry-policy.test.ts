import {
  calculateBackoffDelay,
  canRetryJob,
  getNextRetryDate,
  RetryPolicyConfig,
} from '../../apps/worker/processor/retryPolicy.ts';

describe('Phase 7 Unit Tests: Retry Policies and Backoff Calculation', () => {
  const fixedPolicy: RetryPolicyConfig = {
    strategy: 'FIXED',
    baseDelayMs: 2000,
    maxDelayMs: 10000,
    maxAttempts: 3,
  };

  const linearPolicy: RetryPolicyConfig = {
    strategy: 'LINEAR',
    baseDelayMs: 1500,
    maxDelayMs: 10000,
    maxAttempts: 4,
  };

  const expPolicy: RetryPolicyConfig = {
    strategy: 'EXPONENTIAL',
    baseDelayMs: 1000,
    maxDelayMs: 20000,
    maxAttempts: 5,
    backoffFactor: 2.0,
  };

  describe('calculateBackoffDelay', () => {
    test('FIXED strategy produces constant delay for all attempts', () => {
      expect(calculateBackoffDelay(1, fixedPolicy)).toBe(2000);
      expect(calculateBackoffDelay(2, fixedPolicy)).toBe(2000);
      expect(calculateBackoffDelay(3, fixedPolicy)).toBe(2000);
    });

    test('LINEAR strategy scales proportionally with attempt number', () => {
      expect(calculateBackoffDelay(1, linearPolicy)).toBe(1500); // 1500 * 1
      expect(calculateBackoffDelay(2, linearPolicy)).toBe(3000); // 1500 * 2
      expect(calculateBackoffDelay(3, linearPolicy)).toBe(4500); // 1500 * 3
      expect(calculateBackoffDelay(4, linearPolicy)).toBe(6000); // 1500 * 4
    });

    test('EXPONENTIAL strategy scales exponentially by backoff factor', () => {
      expect(calculateBackoffDelay(1, expPolicy)).toBe(1000); // 1000 * 2^0 = 1000
      expect(calculateBackoffDelay(2, expPolicy)).toBe(2000); // 1000 * 2^1 = 2000
      expect(calculateBackoffDelay(3, expPolicy)).toBe(4000); // 1000 * 2^2 = 4000
      expect(calculateBackoffDelay(4, expPolicy)).toBe(8000); // 1000 * 2^3 = 8000
      expect(calculateBackoffDelay(5, expPolicy)).toBe(16000); // 1000 * 2^4 = 16000
    });

    test('enforces maxDelayMs capping', () => {
      const smallCapPolicy: RetryPolicyConfig = {
        strategy: 'EXPONENTIAL',
        baseDelayMs: 5000,
        maxDelayMs: 12000,
        maxAttempts: 5,
        backoffFactor: 2.0,
      };

      expect(calculateBackoffDelay(1, smallCapPolicy)).toBe(5000);
      expect(calculateBackoffDelay(2, smallCapPolicy)).toBe(10000);
      expect(calculateBackoffDelay(3, smallCapPolicy)).toBe(12000); // capped at 12000 instead of 20000
      expect(calculateBackoffDelay(4, smallCapPolicy)).toBe(12000);
    });

    test('returns 0 for attempt <= 0', () => {
      expect(calculateBackoffDelay(0, fixedPolicy)).toBe(0);
      expect(calculateBackoffDelay(-1, fixedPolicy)).toBe(0);
    });
  });

  describe('canRetryJob', () => {
    test('correctly assesses remaining retry attempts', () => {
      expect(canRetryJob(1, 3)).toBe(true);
      expect(canRetryJob(2, 3)).toBe(true);
      expect(canRetryJob(3, 3)).toBe(false); // attempt 3 of 3 -> exhausted
      expect(canRetryJob(4, 3)).toBe(false);
    });
  });

  describe('getNextRetryDate', () => {
    test('calculates accurate future timestamp', () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const nextDate = getNextRetryDate(2, fixedPolicy, now);
      expect(nextDate.getTime()).toBe(now.getTime() + 2000);
    });
  });
});
