import request from 'supertest';
import { createApiApp } from '../../apps/api/app.ts';
import prisma from '../../src/db/prisma.ts';

const app = createApiApp();
jest.setTimeout(30000);

describe('Phase 5: Job Submission & Inspection Integration Tests', () => {
  const timestamp = Date.now();
  const userEmail = `jobs.user.${timestamp}@scheduler.io`;
  const crossEmail = `jobs.cross.${timestamp}@scheduler.io`;
  const password = 'JobTestPassword123!';

  let userToken: string;
  let crossToken: string;

  let orgId: string;
  let projectId: string;
  let queueId: string;
  let immediateJobId: string;

  let crossOrgId: string;
  let crossProjectId: string;
  let crossQueueId: string;
  let crossJobId: string;

  beforeAll(async () => {
    // 1. User & Org setup
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({ email: userEmail, password, name: 'Job Submitter' });
    userToken = userRes.body.data.token;

    const crossRes = await request(app)
      .post('/api/auth/register')
      .send({ email: crossEmail, password, name: 'Cross Submitter' });
    crossToken = crossRes.body.data.token;

    const orgRes = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: `Job Org ${timestamp}`, slug: `job-org-${timestamp}` });
    orgId = orgRes.body.data.id;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ organizationId: orgId, name: `Job Proj ${timestamp}` });
    projectId = projRes.body.data.id;

    const qRes = await request(app)
      .post(`/api/projects/${projectId}/queues`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: `work-queue-${timestamp}`, priority: 5 });
    queueId = qRes.body.data.id;

    // Cross-tenant setup
    const crossOrgRes = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${crossToken}`)
      .send({ name: `Cross Org ${timestamp}`, slug: `cross-org-${timestamp}` });
    crossOrgId = crossOrgRes.body.data.id;

    const crossProjRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${crossToken}`)
      .send({ organizationId: crossOrgId, name: `Cross Proj ${timestamp}` });
    crossProjectId = crossProjRes.body.data.id;

    const crossQRes = await request(app)
      .post(`/api/projects/${crossProjectId}/queues`)
      .set('Authorization', `Bearer ${crossToken}`)
      .send({ name: `cross-work-queue-${timestamp}` });
    crossQueueId = crossQRes.body.data.id;

    const crossJobRes = await request(app)
      .post(`/api/queues/${crossQueueId}/jobs`)
      .set('Authorization', `Bearer ${crossToken}`)
      .send({ payload: { secret: 'cross-tenant-data' } });
    crossJobId = crossJobRes.body.data.id;
  });

  afterAll(async () => {
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    if (crossOrgId) await prisma.organization.delete({ where: { id: crossOrgId } }).catch(() => {});
    await prisma.user.deleteMany({
      where: { email: { in: [userEmail, crossEmail] } },
    }).catch(() => {});
  });

  describe('1. Single Job Submissions (Immediate, Delayed, Scheduled, Cron)', () => {
    test('POST /api/queues/:queueId/jobs - Submits Immediate Job (status: QUEUED)', async () => {
      const res = await request(app)
        .post(`/api/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'IMMEDIATE',
          priority: 10,
          payload: { orderId: 1001, action: 'process_payment' },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('QUEUED');
      expect(res.body.data.type).toBe('IMMEDIATE');
      expect(res.body.data.priority).toBe(10);
      expect(res.body.data.payload.orderId).toBe(1001);

      immediateJobId = res.body.data.id;
    });

    test('POST /api/queues/:queueId/jobs - Submits Delayed Job with delayMs (status: SCHEDULED, type: DELAYED)', async () => {
      const res = await request(app)
        .post(`/api/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          delayMs: 30000,
          payload: { reminderId: 501 },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SCHEDULED');
      expect(res.body.data.type).toBe('DELAYED');
      expect(new Date(res.body.data.scheduledAt).getTime()).toBeGreaterThan(Date.now() + 25000);
    });

    test('POST /api/queues/:queueId/jobs - Submits Explicit Scheduled Job (future scheduledAt)', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const res = await request(app)
        .post(`/api/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          scheduledAt: futureDate,
          payload: { reportType: 'daily_summary' },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SCHEDULED');
      expect(new Date(res.body.data.scheduledAt).toISOString()).toBe(futureDate);
    });

    test('POST /api/queues/:queueId/jobs - Submits Recurring Cron Job & registers ScheduledJob', async () => {
      const res = await request(app)
        .post(`/api/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cronExpression: '*/15 * * * *',
          payload: { task: 'metrics_sync' },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SCHEDULED');
      expect(res.body.data.type).toBe('CRON');

      // Verify ScheduledJob in database
      const scheduledRecord = await prisma.scheduledJob.findFirst({
        where: { queueId, cronExpression: '*/15 * * * *' },
      });
      expect(scheduledRecord).not.toBeNull();
      expect(scheduledRecord?.cronExpression).toBe('*/15 * * * *');
    });
  });

  describe('2. Idempotency Guarantees & Concurrency Handling', () => {
    const idempotencyKey = `idemp-key-${timestamp}-unique`;

    test('POST /api/queues/:queueId/jobs - Initial submission creates job', async () => {
      const res = await request(app)
        .post(`/api/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          payload: { transferId: 'TXN-999', amount: 500 },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.idempotencyKey).toBe(idempotencyKey);
    });

    test('POST /api/queues/:queueId/jobs - Repeated request with same idempotency key returns existing job without duplicates', async () => {
      const res = await request(app)
        .post(`/api/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          payload: { transferId: 'TXN-999', amount: 500 },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.idempotentReplay).toBe(true);

      // Verify in DB that only 1 record exists
      const count = await prisma.job.count({
        where: { queueId, idempotencyKey },
      });
      expect(count).toBe(1);
    });

    test('Concurrent duplicate requests with identical idempotency key resolve safely to a single record', async () => {
      const concurrentKey = `concurrent-key-${timestamp}`;

      const [res1, res2, res3] = await Promise.all([
        request(app)
          .post(`/api/queues/${queueId}/jobs`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ idempotencyKey: concurrentKey, payload: { sync: 1 } }),
        request(app)
          .post(`/api/queues/${queueId}/jobs`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ idempotencyKey: concurrentKey, payload: { sync: 1 } }),
        request(app)
          .post(`/api/queues/${queueId}/jobs`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ idempotencyKey: concurrentKey, payload: { sync: 1 } }),
      ]);

      expect([200, 201]).toContain(res1.status);
      expect([200, 201]).toContain(res2.status);
      expect([200, 201]).toContain(res3.status);

      const dbJobs = await prisma.job.findMany({
        where: { queueId, idempotencyKey: concurrentKey },
      });
      expect(dbJobs.length).toBe(1);
    });
  });

  describe('3. Atomic Batch Creation & Rollback Guarantee', () => {
    test('POST /api/queues/:queueId/jobs - Creates batch of jobs atomically in single transaction', async () => {
      const res = await request(app)
        .post(`/api/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          jobs: [
            { priority: 1, payload: { item: 1 } },
            { priority: 2, payload: { item: 2 } },
            { priority: 3, payload: { item: 3 } },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(3);
      expect(res.body.data.batchId).toBeDefined();

      const batchId = res.body.data.batchId;
      const count = await prisma.job.count({ where: { batchId } });
      expect(count).toBe(3);
    });

    test('POST /api/queues/:queueId/jobs - Rolls back entire batch if any child job is invalid', async () => {
      const uniqueBatchMarker = `batch-fail-${timestamp}`;
      const res = await request(app)
        .post(`/api/queues/${queueId}/jobs`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          jobs: [
            { priority: 1, payload: { marker: uniqueBatchMarker } },
            { priority: 2, cronExpression: 'INVALID CRON EXPRESSION' }, // Should trigger rollback
            { priority: 3, payload: { marker: uniqueBatchMarker } },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      // Verify that none of the jobs in the batch were created
      const count = await prisma.job.count({
        where: {
          queueId,
          payload: {
            path: ['marker'],
            equals: uniqueBatchMarker,
          },
        },
      });
      expect(count).toBe(0);
    });
  });

  describe('4. Job Listing, Pagination, Filters & Tenant Isolation', () => {
    test('GET /api/queues/:queueId/jobs - Lists jobs with pagination', async () => {
      const res = await request(app)
        .get(`/api/queues/${queueId}/jobs?page=1&limit=5`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.pageSize).toBe(5);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(5);
    });

    test('GET /api/queues/:queueId/jobs - Filters jobs by status', async () => {
      const res = await request(app)
        .get(`/api/queues/${queueId}/jobs?status=QUEUED`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((j: any) => j.status === 'QUEUED')).toBe(true);
    });

    test('GET /api/jobs/:id - Retrieves job details with executions and logs structure', async () => {
      const res = await request(app)
        .get(`/api/jobs/${immediateJobId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(immediateJobId);
      expect(res.body.data.queue).toBeDefined();
      expect(Array.isArray(res.body.data.executions)).toBe(true);
    });

    test('GET /api/jobs/:id - Cross-tenant job inspection returns 404', async () => {
      const res = await request(app)
        .get(`/api/jobs/${crossJobId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });
  });
});
