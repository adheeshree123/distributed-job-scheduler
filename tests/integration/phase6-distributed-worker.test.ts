import request from 'supertest';
import { createApiApp } from '../../apps/api/app.ts';
import prisma from '../../src/db/prisma.ts';
import { WorkerService } from '../../apps/worker/main.ts';
import { ClaimService } from '../../apps/worker/processor/claimService.ts';

const app = createApiApp();
jest.setTimeout(45000);


describe('PHASE 6 INTEGRATION: Distributed Worker Service & Atomic Claiming', () => {
  let authToken: string;
  let orgId: string;
  let projectId: string;
  let queueId: string;
  let workerService: WorkerService;

  beforeAll(async () => {
    // 1. Setup authenticated user, organization, project, queue
    const uniqueSuffix = Date.now().toString().slice(-6);
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `worker-test-${uniqueSuffix}@example.com`,
        password: 'Password123!',
        name: 'Worker Test User',
      });
    authToken = registerRes.body.data.token;

    const orgRes = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: `Worker Org ${uniqueSuffix}` });
    orgId = orgRes.body.data.id;

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ organizationId: orgId, name: `Worker Project ${uniqueSuffix}` });
    projectId = projectRes.body.data.id;


    const queueRes = await request(app)
      .post(`/api/projects/${projectId}/queues`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `worker-queue-${uniqueSuffix}`,
        concurrencyLimit: 10,
        priority: 1,
      });
    queueId = queueRes.body.data.id;

    // Clean up any lingering active test jobs
    await prisma.job.deleteMany({
      where: {
        status: { in: ['QUEUED', 'CLAIMED', 'RUNNING', 'SCHEDULED'] },
      },
    });
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

  test('1. Worker registers identity and records heartbeats in PostgreSQL', async () => {
    const workerIdentity = `worker-node-${Date.now().toString().slice(-5)}`;
    workerService = new WorkerService({
      workerId: workerIdentity,
      concurrency: 5,
      pollIntervalMs: 1000,
      heartbeatIntervalMs: 500,
      leaseDurationSeconds: 30,
      hostname: 'test-host-1',
      processId: process.pid,
    });

    await workerService.start({ autoPoll: false, backgroundLoops: false });

    // Verify worker in DB
    const dbWorker = await prisma.worker.findUnique({
      where: { workerId: workerIdentity },
    });

    expect(dbWorker).toBeDefined();
    expect(dbWorker?.status).toBe('ONLINE');
    expect(dbWorker?.concurrency).toBe(5);
    expect(dbWorker?.hostname).toBe('test-host-1');

    // Trigger explicit heartbeat
    await workerService.leaseManager.sendHeartbeatAndExtendLeases();

    const heartbeats = await prisma.workerHeartbeat.findMany({
      where: { workerId: dbWorker!.id },
    });
    expect(heartbeats.length).toBeGreaterThanOrEqual(1);
    expect(heartbeats[0].activeJobsCount).toBe(0);
    expect(typeof heartbeats[0].cpuUsagePct).toBe('number');
  });

  test('2. Single worker performs atomic claim on QUEUED job', async () => {
    // Create a job
    const jobRes = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'echo', message: 'atomic claim test' },
      });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.data.id;

    // Worker claims the job
    const claimedJobs = await ClaimService.claimJobs(workerService.workerDbId, 1, 30, [queueId]);
    expect(claimedJobs.length).toBe(1);
    expect(claimedJobs[0].jobId).toBe(jobId);
    expect(claimedJobs[0].attemptNumber).toBe(1);

    // Verify DB state
    const claimedDbJob = await prisma.job.findUnique({ where: { id: jobId } });
    expect(claimedDbJob?.status).toBe('CLAIMED');
    expect(claimedDbJob?.lockedByWorkerId).toBe(workerService.workerDbId);
    expect(claimedDbJob?.attemptCount).toBe(1);
    expect(claimedDbJob?.leaseExpiresAt).toBeDefined();
  });

  test('3. CRITICAL CONCURRENCY: Two workers competing for ONE job -> Exactly ONE succeeds', async () => {
    // Ensure only one job exists in queue for race condition test
    await prisma.job.deleteMany({ where: { queueId } });

    // Create a single competing job
    const jobRes = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'echo', test: 'race condition test' },
      });
    const jobId = jobRes.body.data.id;

    // Create 2 mock worker DB identities
    const worker1 = await prisma.worker.create({
      data: {
        workerId: `comp-worker-1-${Date.now()}`,
        hostname: 'host-a',
        processId: 101,
        status: 'ONLINE',
        concurrency: 5,
        lastHeartbeatAt: new Date(),
      },
    });

    const worker2 = await prisma.worker.create({
      data: {
        workerId: `comp-worker-2-${Date.now()}`,
        hostname: 'host-b',
        processId: 102,
        status: 'ONLINE',
        concurrency: 5,
        lastHeartbeatAt: new Date(),
      },
    });

    // Both workers fire claim simultaneously via Promise.all
    const [claims1, claims2] = await Promise.all([
      ClaimService.claimJobs(worker1.id, 1, 30, [queueId]),
      ClaimService.claimJobs(worker2.id, 1, 30, [queueId]),
    ]);

    const totalClaimed = claims1.length + claims2.length;
    expect(totalClaimed).toBe(1);

    const winningWorkerId = claims1.length === 1 ? worker1.id : worker2.id;
    const losingClaims = claims1.length === 1 ? claims2 : claims1;

    expect(losingClaims.length).toBe(0);

    const jobInDb = await prisma.job.findUnique({ where: { id: jobId } });
    expect(jobInDb?.status).toBe('CLAIMED');
    expect(jobInDb?.lockedByWorkerId).toBe(winningWorkerId);
  });

  test('4. Queue concurrency limits are strictly enforced at database level', async () => {
    // Create restricted queue with concurrencyLimit = 2
    const unique = Date.now().toString().slice(-4);
    const queueRes = await request(app)
      .post(`/api/projects/${projectId}/queues`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `restricted-queue-${unique}`,
        concurrencyLimit: 2,
      });
    const restrictedQueueId = queueRes.body.data.id;

    // Submit 4 jobs to this queue
    for (let i = 0; i < 4; i++) {
      await request(app)
        .post(`/api/queues/${restrictedQueueId}/jobs`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'IMMEDIATE',
          payload: { type: 'echo', index: i },
        });
    }

    // Worker attempts to claim up to 10 jobs
    const claimed = await ClaimService.claimJobs(workerService.workerDbId, 10, 30, [restrictedQueueId]);
    // Should ONLY claim 2 jobs because queue concurrency limit is 2
    const restrictedClaims = claimed.filter((j) => j.queueId === restrictedQueueId);
    expect(restrictedClaims.length).toBe(2);

    // Attempting to claim again while 2 are active returns 0 jobs for this queue
    const secondClaim = await ClaimService.claimJobs(workerService.workerDbId, 10, 30, [restrictedQueueId]);
    const secondRestricted = secondClaim.filter((j) => j.queueId === restrictedQueueId);
    expect(secondRestricted.length).toBe(0);
  });

  test('5. Paused queue produces 0 claimed jobs', async () => {
    const unique = Date.now().toString().slice(-4);
    const queueRes = await request(app)
      .post(`/api/projects/${projectId}/queues`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `paused-queue-${unique}`,
        concurrencyLimit: 5,
      });
    const pausedQueueId = queueRes.body.data.id;

    // Pause queue
    await request(app)
      .post(`/api/queues/${pausedQueueId}/pause`)
      .set('Authorization', `Bearer ${authToken}`);

    // Submit job
    await request(app)
      .post(`/api/queues/${pausedQueueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'echo', msg: 'should not be claimed' },
      });

    // Attempt claim
    const claimed = await ClaimService.claimJobs(workerService.workerDbId, 5, 30, [pausedQueueId]);
    const pausedClaims = claimed.filter((j) => j.queueId === pausedQueueId);
    expect(pausedClaims.length).toBe(0);
  });

  test('6. End-to-end execution of deterministic job creates executions and logs', async () => {
    const jobRes = await request(app)
      .post(`/api/queues/${queueId}/jobs`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'IMMEDIATE',
        payload: { type: 'echo', user: 'Alice', action: 'deploy' },
      });
    const jobId = jobRes.body.data.id;


    // Process job with worker service
    const claimed = await workerService.processor.claimNextJobs(1, [queueId]);
    expect(claimed.length).toBe(1);
    await workerService.processor.processJob(claimed[0]);

    // Verify job transitioned to COMPLETED

    const completedJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: { executions: true, logs: true },
    });

    expect(completedJob?.status).toBe('COMPLETED');
    expect(completedJob?.completedAt).toBeDefined();
    expect((completedJob?.result as any)?.echoed).toEqual(
      expect.objectContaining({ user: 'Alice', action: 'deploy' })
    );

    // Verify JobExecution record
    expect(completedJob?.executions.length).toBe(1);
    expect(completedJob?.executions[0].status).toBe('COMPLETED');
    expect(completedJob?.executions[0].durationMs).toBeGreaterThanOrEqual(0);

    // Verify JobLog records
    expect(completedJob?.logs.length).toBeGreaterThanOrEqual(2);
    const messages = completedJob?.logs.map((l) => l.message).join(' ');
    expect(messages).toContain('Job claimed');
    expect(messages).toContain('Job completed successfully');
  });

  test('7. Worker observability APIs return active workers and heartbeat metrics', async () => {
    // Refresh heartbeat
    await workerService.leaseManager.sendHeartbeatAndExtendLeases();

    // List workers
    const listRes = await request(app)
      .get('/api/workers')
      .set('Authorization', `Bearer ${authToken}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);

    const target = listRes.body.data.find((w: any) => w.id === workerService.workerDbId);
    expect(target).toBeDefined();
    expect(target.status).toBe('ONLINE');

    // Get worker details
    const detailRes = await request(app)
      .get(`/api/workers/${workerService.workerDbId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe(workerService.workerDbId);

    // Get worker heartbeats
    const hbRes = await request(app)
      .get(`/api/workers/${workerService.workerDbId}/heartbeats`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(hbRes.status).toBe(200);
    expect(Array.isArray(hbRes.body.data)).toBe(true);
    expect(hbRes.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test('8. Graceful shutdown drains active work and marks worker OFFLINE', async () => {
    await workerService.shutdown();

    const offlineWorker = await prisma.worker.findUnique({
      where: { id: workerService.workerDbId },
    });
    expect(offlineWorker?.status).toBe('OFFLINE');
    expect(offlineWorker?.stoppedAt).toBeDefined();
  });
});
