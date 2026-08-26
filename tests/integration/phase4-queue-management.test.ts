import request from 'supertest';
import { createApiApp } from '../../apps/api/app.ts';
import prisma from '../../src/db/prisma.ts';

const app = createApiApp();
jest.setTimeout(30000);

describe('Phase 4: Queue Management Integration Tests', () => {
  const timestamp = Date.now();
  const ownerEmail = `queue.owner.${timestamp}@scheduler.io`;
  const memberEmail = `queue.member.${timestamp}@scheduler.io`;
  const crossEmail = `queue.cross.${timestamp}@scheduler.io`;
  const password = 'QueuePassword123!';

  let ownerToken: string;
  let ownerId: string;
  let memberToken: string;
  let memberId: string;
  let crossToken: string;

  let orgId: string;
  let projectId: string;
  let queueId: string;
  let crossOrgId: string;
  let crossProjectId: string;
  let crossQueueId: string;

  beforeAll(async () => {
    // 1. Register Owner
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: ownerEmail, password, name: 'Queue Owner' });
    ownerToken = ownerRes.body.data.token;
    ownerId = ownerRes.body.data.user.id;

    // 2. Register Member
    const memberRes = await request(app)
      .post('/api/auth/register')
      .send({ email: memberEmail, password, name: 'Queue Member' });
    memberToken = memberRes.body.data.token;
    memberId = memberRes.body.data.user.id;

    // 3. Register Cross Tenant User
    const crossRes = await request(app)
      .post('/api/auth/register')
      .send({ email: crossEmail, password, name: 'Cross User' });
    crossToken = crossRes.body.data.token;

    // 4. Create primary organization & project
    const orgRes = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `Queue Org ${timestamp}`, slug: `queue-org-${timestamp}` });
    orgId = orgRes.body.data.id;

    // Add member to org as MEMBER
    await prisma.organizationMember.create({
      data: { organizationId: orgId, userId: memberId, role: 'MEMBER' },
    });

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId: orgId, name: `Queue Project ${timestamp}` });
    projectId = projRes.body.data.id;

    // 5. Create cross-tenant org, project & queue
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
      .send({ name: 'cross-queue' });
    crossQueueId = crossQRes.body.data.id;
  });

  afterAll(async () => {
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    if (crossOrgId) await prisma.organization.delete({ where: { id: crossOrgId } }).catch(() => {});
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, memberEmail, crossEmail] } },
    }).catch(() => {});
  });

  describe('1. Queue Lifecycle & Configuration', () => {
    test('POST /api/projects/:projectId/queues - Creates a new queue with custom concurrency & priority', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/queues`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: `high-priority-events-${timestamp}`,
          description: 'High throughput event queue',
          priority: 10,
          concurrencyLimit: 25,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe(`high-priority-events-${timestamp}`);
      expect(res.body.data.concurrencyLimit).toBe(25);
      expect(res.body.data.priority).toBe(10);
      expect(res.body.data.isPaused).toBe(false);
      queueId = res.body.data.id;
    });

    test('POST /api/projects/:projectId/queues - Rejects duplicate queue name within same project with 409', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/queues`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: `high-priority-events-${timestamp}`,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('QUEUE_EXISTS');
    });

    test('POST /api/projects/:projectId/queues - Validates concurrencyLimit >= 1', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/queues`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: `invalid-concurrency-${timestamp}`,
          concurrencyLimit: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('GET /api/projects/:projectId/queues - Lists queues with pagination and counts', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/queues?page=1&limit=10`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    test('GET /api/queues/:id - Retrieves queue details', async () => {
      const res = await request(app)
        .get(`/api/queues/${queueId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(queueId);
      expect(res.body.data.project).toBeDefined();
    });

    test('PATCH /api/queues/:id - Updates concurrency limit and priority', async () => {
      const res = await request(app)
        .patch(`/api/queues/${queueId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          concurrencyLimit: 50,
          priority: 20,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.concurrencyLimit).toBe(50);
      expect(res.body.data.priority).toBe(20);
    });
  });

  describe('2. Pause, Resume & Stats', () => {
    test('POST /api/queues/:id/pause - Pauses the queue', async () => {
      const res = await request(app)
        .post(`/api/queues/${queueId}/pause`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPaused).toBe(true);
    });

    test('POST /api/queues/:id/resume - Resumes the queue', async () => {
      const res = await request(app)
        .post(`/api/queues/${queueId}/resume`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPaused).toBe(false);
    });

    test('GET /api/queues/:id/stats - Returns aggregate statistics and status distribution', async () => {
      const res = await request(app)
        .get(`/api/queues/${queueId}/stats`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.queueId).toBe(queueId);
      expect(res.body.data.statusCounts).toBeDefined();
      expect(res.body.data.statusCounts.QUEUED).toBeDefined();
      expect(res.body.data.statusCounts.RUNNING).toBeDefined();
      expect(res.body.data.inFlightCount).toBeDefined();
      expect(res.body.data.availableCapacity).toBeDefined();
    });
  });

  describe('3. RBAC & Cross-Tenant Isolation', () => {
    test('RBAC: MEMBER cannot pause queue (returns 403)', async () => {
      const res = await request(app)
        .post(`/api/queues/${queueId}/pause`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('RBAC: MEMBER cannot delete queue (returns 403)', async () => {
      const res = await request(app)
        .delete(`/api/queues/${queueId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('RBAC: MEMBER can read queue stats (returns 200)', async () => {
      const res = await request(app)
        .get(`/api/queues/${queueId}/stats`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('Tenant Isolation: Cross-tenant queue access returns 404', async () => {
      const res = await request(app)
        .get(`/api/queues/${crossQueueId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('QUEUE_NOT_FOUND');
    });
  });
});
