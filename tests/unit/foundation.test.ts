import request from 'supertest';
import { createApiApp } from '../../apps/api/app.ts';
import { openApiSpec } from '../../apps/api/openapi.ts';
import { getWorkerConfig } from '../../apps/worker/config.ts';

describe('Distributed Job Scheduler - Foundation Verification', () => {
  const app = createApiApp();

  test('GET /api/health returns operational status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'distributed-job-scheduler-api');
    expect(res.body).toHaveProperty('version', '1.0.0');
  });

  test('GET /api/info returns architecture blueprint', async () => {
    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('database', 'PostgreSQL (Prisma ORM)');
    expect(res.body.architecture).toHaveProperty('concurrencyEngine');
    expect(res.body.architecture.concurrencyEngine).toContain('SKIP LOCKED');
  });

  test('OpenAPI specification includes core schemas and paths', () => {
    expect(openApiSpec.openapi).toBe('3.0.3');
    expect(openApiSpec.components.schemas).toHaveProperty('Job');
    expect(openApiSpec.components.schemas).toHaveProperty('Queue');
    expect(openApiSpec.components.schemas).toHaveProperty('Worker');
  });

  test('Worker config parses environment defaults properly', () => {
    const config = getWorkerConfig();
    expect(config).toHaveProperty('workerId');
    expect(config.concurrency).toBeGreaterThan(0);
    expect(config.leaseDurationSeconds).toBeGreaterThan(0);
    expect(config.pollIntervalMs).toBeGreaterThan(0);
  });
});
