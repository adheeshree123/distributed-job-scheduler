import { JobExecutor } from '../../apps/worker/processor/executor.ts';

describe('Phase 6 Unit Tests: Deterministic Job Executor', () => {
  test('echo handler returns echoed payload and execution metadata', async () => {
    const output = await JobExecutor.execute({
      jobId: 'job-123',
      attemptNumber: 1,
      type: 'echo',
      payload: { greeting: 'hello world', count: 42 },
    });

    expect(output.success).toBe(true);
    expect(output.result).toBeDefined();
    expect((output.result as any).echoed).toEqual({ greeting: 'hello world', count: 42 });
    expect((output.result as any).attempt).toBe(1);
  });

  test('sleep handler completes successfully after specified duration', async () => {
    const start = Date.now();
    const output = await JobExecutor.execute({
      jobId: 'job-456',
      attemptNumber: 1,
      type: 'sleep',
      payload: { durationMs: 50 },
    });

    const elapsed = Date.now() - start;
    expect(output.success).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect((output.result as any).sleptMs).toBe(50);
  });

  test('fail handler catches error and returns failure output', async () => {
    const output = await JobExecutor.execute({
      jobId: 'job-789',
      attemptNumber: 1,
      type: 'fail',
      payload: { message: 'Database connection failed' },
    });

    expect(output.success).toBe(false);
    expect(output.errorMessage).toBe('Database connection failed');
  });

  test('fail-once handler fails on attempt 1 and succeeds on attempt 2', async () => {
    const attempt1 = await JobExecutor.execute({
      jobId: 'job-once',
      attemptNumber: 1,
      type: 'fail-once',
      payload: {},
    });
    expect(attempt1.success).toBe(false);
    expect(attempt1.errorMessage).toContain('fail-once');

    const attempt2 = await JobExecutor.execute({
      jobId: 'job-once',
      attemptNumber: 2,
      type: 'fail-once',
      payload: {},
    });
    expect(attempt2.success).toBe(true);
    expect((attempt2.result as any).succeededOnAttempt).toBe(2);
  });

  test('fail-n-times handler fails until attempts exceed threshold', async () => {
    const payload = { failuresBeforeSuccess: 2 };

    const att1 = await JobExecutor.execute({
      jobId: 'job-n',
      attemptNumber: 1,
      type: 'fail-n-times',
      payload,
    });
    expect(att1.success).toBe(false);

    const att2 = await JobExecutor.execute({
      jobId: 'job-n',
      attemptNumber: 2,
      type: 'fail-n-times',
      payload,
    });
    expect(att2.success).toBe(false);

    const att3 = await JobExecutor.execute({
      jobId: 'job-n',
      attemptNumber: 3,
      type: 'fail-n-times',
      payload,
    });
    expect(att3.success).toBe(true);
    expect((att3.result as any).succeededOnAttempt).toBe(3);
  });
});
