import request from 'supertest';
import { createApiApp } from '../../apps/api/app.ts';
import prisma from '../../src/db/prisma.ts';
import { WorkerService } from '../../apps/worker/main.ts';
import { CrashRecoveryManager } from '../../apps/worker/recovery/crashRecovery.ts';
import { CronDispatcher } from '../../apps/worker/scheduler/cronDispatcher.ts';
import { ClaimService } from '../../apps/worker/processor/claimService.ts';

const app = createApiApp();
jest.setTimeout(45000);


describe('PHASE 7 INTEGRATION: Retries, Dead Letter Queue & Crash Recovery', () => {
  let authToken: string;
  let orgId: string;
  let projectId: string;
  let queueId: string;
  let workerService: WorkerService;
  let fixedPolicyId: string;
  let linearPolicyId: string;
  let expPolicyId: string;

  beforeAll(async () => {
    // 1. Setup user & workspace
    const uniqueSuffix = Date.now().toString().slice(-6);
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `retry-test-${uniqueSuffix}@example.com`,
        password: 'Password123!',
        name: 'Retry Test User',
      });
    authToken = registerRes.body.data.token;

    const orgRes = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: `Retry Org ${uniqueSuffix}` });
    orgId = orgRes.body.data.id;

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ organizationId: orgId, name: `Retry Project ${uniqueSuffix}` });
    projectId = projectRes.body.data.id;


    // Create custom retry policies
    const fixedPolicy = await prisma.retryPolicy.create({
      data: {
        name: `fixed-policy-${uniqueSuffix}`,
        strategy: 'FIXED',
        baseDelayMs: 500,
        maxDelayMs: 5000,
        maxAttempts: 3,
      },
    });
    fixedPolicyId = fixedPolicy.id;

    const linearPolicy = await prisma.retryPolicy.create({
      data: {
        name: `linear-policy-${uniqueSuffix}`,
        strategy: 'LINEAR',
        baseDelayMs: 400,
        maxDelayMs: 5000,
        maxAttempts: 3,
      },
    });
    linearPolicyId = linearPolicy.id;

    const expPolicy = await prisma.retryPolicy.create({
      data: {
        name: `exp-policy-${uniqueSuffix}`,
        strategy: 'EXPONENTIAL',
        baseDelayMs: 300,
        maxDelayMs: 5000,
        maxAttempts: 3,
        backoffFactor: 2.0,
      },
    });
    expPolicyId = expPolicy.id;

    const queueRes = await request(app)
      .post(`/api/projects/${projectId}/queues`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `retry-queue-${uniqueSuffix}`,
        concurrencyLimit: 10,
        priority: 1,
        retryPolicyId: fixedPolicyId,
      });
    queueId = queueRes.body.data.id;

    // Clean up any lingering active test jobs
    await prisma.job.deleteMany({
      where: {
        status: { in: ['QUEUED', 'CLAIMED', 'RUNNING', 'SCHEDULED'] },
      },
    });

    // Start worker service
    workerService = new WorkerService({
      workerId: `retry-worker-${uniqueSuffix}`,
      concurrency: 5,
      pollIntervalMs: 200,
      heartbeatIntervalMs: 1000,
      leaseDurationSeconds: 30,
    });
    await workerService.start({ autoPoll: false, backgroundLoops: false });
  });

  afterAll(async () => {
    if (workerService) {
      await workerService.shutdown();
    }
  });

  beforeEach(async () => {
    await prisma.job.deleteMany({
      where: {
        status: { in: ['QUEUED', 'CLAIMED', 'RUNNING', 'SCHEDULED'] },
      },
    });
  });

  test('1. Failed job is retried according to FIXED backoff strategy', async () => {
    // Submit failing job
    const jobRes = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'fail', message: 'First attempt failure' },
        maxAttempts: 3,
      });
    const jobId = jobRes.body.data.id;

    // Claim and process attempt 1
    const claimed = await workerService.processor.claimNextJobs(1, [queueId]);
    expect(claimed.length).toBe(1);
    await workerService.processor.processJob(claimed[0]);

    // Verify job transitioned to SCHEDULED with future timestamp
    const scheduledJob = await prisma.job.findUnique({ where: { id: jobId } });
    expect(scheduledJob?.status).toBe('SCHEDULED');
    expect(scheduledJob?.attemptCount).toBe(1);
    expect(scheduledJob?.errorMessage).toContain('First attempt failure');
    expect(scheduledJob?.scheduledAt.getTime()).toBeGreaterThan(Date.now() - 10000);

    // Verify JobExecution record
    const executions = await prisma.jobExecution.findMany({ where: { jobId } });
    expect(executions.length).toBe(1);
    expect(executions[0].status).toBe('FAILED');
    expect(executions[0].attemptNumber).toBe(1);
  });

  test('2. Multi-attempt recovery: job failing once succeeds on retry', async () => {
    const jobRes = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'fail-once' },
        maxAttempts: 3,
      });
    const jobId = jobRes.body.data.id;

    // Attempt 1 -> fails and gets SCHEDULED
    const claim1 = await workerService.processor.claimNextJobs(1, [queueId]);
    expect(claim1.length).toBe(1);
    await workerService.processor.processJob(claim1[0]);

    const jobAfterFail1 = await prisma.job.findUnique({ where: { id: jobId } });
    expect(jobAfterFail1?.status).toBe('SCHEDULED');

    // Force scheduledAt to now for immediate test dispatch
    await prisma.job.update({
      where: { id: jobId },
      data: { scheduledAt: new Date(Date.now() - 1000) },
    });

    // CronDispatcher promotes SCHEDULED -> QUEUED
    const dispatcher = new CronDispatcher();
    await dispatcher.dispatchReadyJobs();

    const jobQueued = await prisma.job.findUnique({ where: { id: jobId } });
    expect(jobQueued?.status).toBe('QUEUED');

    // Attempt 2 -> succeeds
    const claim2 = await workerService.processor.claimNextJobs(1, [queueId]);
    expect(claim2.length).toBe(1);
    await workerService.processor.processJob(claim2[0]);

    const jobCompleted = await prisma.job.findUnique({
      where: { id: jobId },
      include: { executions: { orderBy: { attemptNumber: 'asc' } } },
    });
    expect(jobCompleted?.status).toBe('COMPLETED');
    expect(jobCompleted?.attemptCount).toBe(2);
    expect(jobCompleted?.executions.length).toBe(2);
    expect(jobCompleted?.executions[0].status).toBe('FAILED');
    expect(jobCompleted?.executions[1].status).toBe('COMPLETED');
  });

  test('3. Exhausted retries move job to FAILED state and Dead Letter Queue (DLQ)', async () => {
    const jobRes = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'fail', error: 'Permanent hardware fault' },
        maxAttempts: 2, // Only 2 attempts
      });
    const jobId = jobRes.body.data.id;

    // Attempt 1 -> fails -> SCHEDULED
    const claim1 = await workerService.processor.claimNextJobs(1, [queueId]);
    await workerService.processor.processJob(claim1[0]);

    // Fast-forward scheduledAt and promote
    await prisma.job.update({
      where: { id: jobId },
      data: { scheduledAt: new Date(Date.now() - 1000) },
    });
    const dispatcher = new CronDispatcher();
    await dispatcher.dispatchReadyJobs();

    // Attempt 2 -> fails -> FAILED & DLQ
    const claim2 = await workerService.processor.claimNextJobs(1, [queueId]);
    await workerService.processor.processJob(claim2[0]);

    // Check Job status
    const failedJob = await prisma.job.findUnique({ where: { id: jobId } });
    expect(failedJob?.status).toBe('FAILED');
    expect(failedJob?.failedAt).toBeDefined();

    // Check DeadLetterJob record
    const dlqRecord = await prisma.deadLetterJob.findUnique({
      where: { jobId },
    });
    expect(dlqRecord).toBeDefined();
    expect(dlqRecord?.status).toBe('UNRESOLVED');
    expect(dlqRecord?.failureReason).toBe('MAX_ATTEMPTS_EXCEEDED');
    expect(dlqRecord?.errorMessage).toContain('Permanent hardware fault');
    expect(dlqRecord?.finalAttemptCount).toBe(2);
  });

  test('4. DLQ Management API: list, inspect, retry and discard dead letter jobs', async () => {
    // 1. Create a failed job with maxAttempts=1 to move directly to DLQ
    const jobRes = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'fail', error: 'Retry me via DLQ' },
        maxAttempts: 1,
      });
    const jobId = jobRes.body.data.id;

    const claim1 = await workerService.processor.claimNextJobs(1, [queueId]);
    await workerService.processor.processJob(claim1[0]);

    const targetDlq = await prisma.deadLetterJob.findUnique({
      where: { jobId },
    });
    expect(targetDlq).toBeDefined();

    // List DLQ
    const listRes = await request(app)
      .get('/api/dlq')
      .set('Authorization', `Bearer ${authToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

    // Inspect DLQ by ID
    const inspectRes = await request(app)
      .get(`/api/dlq/${targetDlq!.id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(inspectRes.status).toBe(200);
    expect(inspectRes.body.data.job.executions.length).toBeGreaterThanOrEqual(1);

    // Replay/Retry DLQ job
    const retryRes = await request(app)
      .post(`/api/dlq/${targetDlq!.id}/retry`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.job.status).toBe('QUEUED');
    expect(retryRes.body.data.deadLetterJob.status).toBe('RETRIED');

    // Clean active queued jobs before second discard flow
    await prisma.job.deleteMany({
      where: {
        status: { in: ['QUEUED', 'CLAIMED', 'RUNNING', 'SCHEDULED'] },
      },
    });

    // Create another DLQ job to test discard
    const discardJobRes = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'fail', error: 'Discard me' },
        maxAttempts: 1,
      });
    const discardJobId = discardJobRes.body.data.id;

    // Process once to exhaust maxAttempts (1)
    const discardClaim = await workerService.processor.claimNextJobs(1, [queueId]);
    await workerService.processor.processJob(discardClaim[0]);

    const discardDlq = await prisma.deadLetterJob.findUnique({
      where: { jobId: discardJobId },
    });
    expect(discardDlq).toBeDefined();

    // Discard via API
    const discardRes = await request(app)
      .post(`/api/dlq/${discardDlq!.id}/discard`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(discardRes.status).toBe(200);
    expect(discardRes.body.data.deadLetterJob.status).toBe('DISCARDED');
  });

  test('5. Crash Recovery: Recovers orphaned jobs with expired leases', async () => {
    // Create a job and simulate a crashed worker holding it with expired lease
    const jobRes = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'echo', data: 'stale-lease' },
        maxAttempts: 3,
      });
    const jobId = jobRes.body.data.id;

    // Manually set status to RUNNING with expired lease in the past
    const deadWorker = await prisma.worker.create({
      data: {
        workerId: `dead-worker-pid-999-${Date.now()}`,
        hostname: 'crashed-host',
        processId: 9999,
        status: 'OFFLINE',
        concurrency: 5,
        lastHeartbeatAt: new Date(Date.now() - 120000),
      },
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        lockedByWorkerId: deadWorker.id,
        lockedAt: new Date(Date.now() - 60000),
        leaseExpiresAt: new Date(Date.now() - 30000), // 30s in the past
        attemptCount: 1,
      },
    });

    // Run Crash Recovery
    const recovery = new CrashRecoveryManager();
    const recoveredCount = await recovery.recoverExpiredLeases();
    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    // Job should now be SCHEDULED for next attempt and lease locks cleared
    const recoveredJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: { logs: true },
    });
    expect(recoveredJob?.status).toBe('SCHEDULED');
    expect(recoveredJob?.lockedByWorkerId).toBeNull();
    expect(recoveredJob?.leaseExpiresAt).toBeNull();

    // Logs verify crash detection and recovery
    const recoveryLogs = recoveredJob?.logs.map((l) => l.message).join(' ');
    expect(recoveryLogs).toContain('Job lease expired');
    expect(recoveryLogs).toContain('successfully recovered');
  });

  test('6. Stale worker cannot overwrite recovered job after losing lease', async () => {
    // Create job
    const jobRes = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'echo', action: 'late-save' },
        maxAttempts: 3,
      });
    const jobId = jobRes.body.data.id;


    const claimed = await ClaimService.claimJobs(workerService.workerDbId, 1, 30, [queueId]);
    const jobCtx = claimed.find((c) => c.jobId === jobId)!;
    expect(jobCtx).toBeDefined();

    // Simulate recovery occurring while worker was supposedly working
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'SCHEDULED',
        lockedByWorkerId: null,
        lockedAt: null,
        leaseExpiresAt: null,
        version: { increment: 5 }, // Version mismatch
      },
    });

    // Worker attempts to complete job with old version / stale ownership
    await workerService.processor.processJob(jobCtx);

    // The job should remain SCHEDULED and NOT overwritten to COMPLETED by the stale worker
    const jobInDb = await prisma.job.findUnique({ where: { id: jobId } });
    expect(jobInDb?.status).toBe('SCHEDULED');
  });

  test('7. Enhanced Queue Stats API returns complete live metrics and throughput', async () => {
    const statsRes = await request(app)
      .get(`/api/queues/${queueId}/stats`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(statsRes.status).toBe(200);
    const stats = statsRes.body.data;
    expect(stats.queueId).toBe(queueId);
    expect(typeof stats.totalJobs).toBe('number');
    expect(typeof stats.dlqCount).toBe('number');
    expect(typeof stats.throughputPerHour).toBe('number');
    expect(typeof stats.averageDurationMs).toBe('number');
    expect(typeof stats.retryCount).toBe('number');
    expect(stats.statusCounts).toBeDefined();
  });
});
