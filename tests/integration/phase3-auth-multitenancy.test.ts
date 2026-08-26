import request from 'supertest';
import { createApiApp } from '../../apps/api/app.ts';
import prisma from '../../src/db/prisma.ts';

const app = createApiApp();
jest.setTimeout(30000);

describe('Phase 3: Authentication & Multi-Tenancy Integration Tests', () => {
  const timestamp = Date.now();
  const user1Email = `test.user1.${timestamp}@scheduler.io`;
  const user2Email = `test.user2.${timestamp}@scheduler.io`;
  const crossTenantEmail = `test.tenant.b.${timestamp}@scheduler.io`;
  const password = 'SecurePassword123!';

  let user1Token: string;
  let user1Id: string;
  let user2Token: string;
  let user2Id: string;
  let crossTenantToken: string;

  let orgId: string;
  let projectId: string;
  let crossOrgId: string;

  beforeAll(async () => {
    // Clean any prior potential collision
  });

  afterAll(async () => {
    // Clean up created orgs
    if (orgId) {
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }
    if (crossOrgId) {
      await prisma.organization.delete({ where: { id: crossOrgId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: {
        email: { in: [user1Email, user2Email, crossTenantEmail] },
      },
    }).catch(() => {});
  });

  describe('1. Authentication Endpoints', () => {
    test('POST /api/auth/register - Successfully registers new user and returns JWT', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: user1Email,
          password,
          name: 'Primary Owner User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(user1Email);
      expect(res.body.data.user.name).toBe('Primary Owner User');
      expect((res.body.data.user as any).passwordHash).toBeUndefined();

      user1Token = res.body.data.token;
      user1Id = res.body.data.user.id;
    });

    test('POST /api/auth/register - Rejects duplicate email with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: user1Email,
          password,
          name: 'Duplicate Attempt',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    test('POST /api/auth/register - Registers secondary user (for MEMBER tests)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: user2Email,
          password,
          name: 'Member User',
        });

      expect(res.status).toBe(201);
      user2Token = res.body.data.token;
      user2Id = res.body.data.user.id;
    });

    test('POST /api/auth/register - Registers separate cross-tenant user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: crossTenantEmail,
          password,
          name: 'Cross Tenant User',
        });

      expect(res.status).toBe(201);
      crossTenantToken = res.body.data.token;
    });

    test('POST /api/auth/login - Successfully logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: user1Email,
          password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(user1Email);
      expect((res.body.data.user as any).passwordHash).toBeUndefined();
    });

    test('POST /api/auth/login - Rejects invalid password with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: user1Email,
          password: 'WrongPassword456!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('GET /api/auth/me - Rejects requests without JWT token with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/auth/me - Rejects requests with malformed JWT token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/auth/me - Returns current user profile with valid JWT', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(user1Id);
      expect(res.body.data.email).toBe(user1Email);
      expect(res.body.data.memberships).toBeDefined();
    });
  });

  describe('2. Organization & Multi-Tenancy Scoping', () => {
    test('POST /api/organizations - Creates organization and assigns creator as OWNER', async () => {
      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: `Alpha Ingest Org ${timestamp}`,
          slug: `alpha-ingest-${timestamp}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe(`Alpha Ingest Org ${timestamp}`);
      orgId = res.body.data.id;

      // Verify membership in DB
      const member = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: user1Id,
          },
        },
      });
      expect(member).not.toBeNull();
      expect(member?.role).toBe('OWNER');
    });

    test('POST /api/organizations - Creates second cross-tenant organization', async () => {
      const res = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${crossTenantToken}`)
        .send({
          name: `Beta Cross Org ${timestamp}`,
          slug: `beta-cross-${timestamp}`,
        });

      expect(res.status).toBe(201);
      crossOrgId = res.body.data.id;
    });

    test('GET /api/organizations - Lists only organizations user belongs to', async () => {
      const res = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((o: any) => o.id);
      expect(ids).toContain(orgId);
      expect(ids).not.toContain(crossOrgId);
    });

    test('GET /api/organizations/:id - Returns organization for authorized member', async () => {
      const res = await request(app)
        .get(`/api/organizations/${orgId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(orgId);
    });

    test('GET /api/organizations/:id - Cross-tenant protection returns 404 (does not leak existence)', async () => {
      const res = await request(app)
        .get(`/api/organizations/${crossOrgId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
    });

    test('PATCH /api/organizations/:id - Updates organization name for OWNER', async () => {
      const res = await request(app)
        .patch(`/api/organizations/${orgId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: `Alpha Ingest Updated ${timestamp}`,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(`Alpha Ingest Updated ${timestamp}`);
    });
  });

  describe('3. Project Management & RBAC Authorization', () => {
    test('POST /api/projects - Creates project under organization as OWNER', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          organizationId: orgId,
          name: `Data Pipeline ${timestamp}`,
          slug: `data-pipe-${timestamp}`,
          description: 'Core streaming pipeline',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.organizationId).toBe(orgId);
      projectId = res.body.data.id;
    });

    test('GET /api/projects/:id - Retrieves project for authorized organization member', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(projectId);
    });

    test('GET /api/projects/:id - Cross-tenant user access returns 404', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${crossTenantToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    test('RBAC: Add user2 as MEMBER to orgId and verify authorization restrictions', async () => {
      // Add user2 as MEMBER
      await prisma.organizationMember.create({
        data: {
          organizationId: orgId,
          userId: user2Id,
          role: 'MEMBER',
        },
      });

      // User2 (MEMBER) can read project
      const readRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${user2Token}`);
      expect(readRes.status).toBe(200);

      // User2 (MEMBER) cannot create project (requires OWNER or ADMIN) -> 403
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          organizationId: orgId,
          name: `Forbidden Project ${timestamp}`,
        });
      expect(createRes.status).toBe(403);
      expect(createRes.body.error.code).toBe('FORBIDDEN');

      // User2 (MEMBER) cannot delete project (requires OWNER) -> 403
      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${user2Token}`);
      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error.code).toBe('FORBIDDEN');
    });

    test('PATCH /api/projects/:id - Updates project description as OWNER', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          description: 'Updated pipeline description',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Updated pipeline description');
    });
  });
});
