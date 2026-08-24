import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from '../openapi.ts';

export const apiRouter = Router();

// Swagger Documentation Route
const swaggerServe = (swaggerUi as any).serve || (swaggerUi as any).default?.serve;
const swaggerSetup = (swaggerUi as any).setup || (swaggerUi as any).default?.setup;

if (swaggerServe && swaggerSetup) {
  apiRouter.use('/docs', swaggerServe, swaggerSetup(openApiSpec));
} else {
  apiRouter.get('/docs', (req: Request, res: Response) => {
    res.json(openApiSpec);
  });
}

// System Health & Diagnostics
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'distributed-job-scheduler-api',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
  });
});

// Architecture Overview Info Route
apiRouter.get('/info', (req: Request, res: Response) => {
  res.json({
    system: 'Distributed Job Scheduler',
    database: 'PostgreSQL (Prisma ORM)',
    architecture: {
      concurrencyEngine: 'SELECT FOR UPDATE SKIP LOCKED row-level locking',
      leaseManagement: 'Lease expiration + periodic worker heartbeat extension',
      idempotency: 'Unique composite database constraints on (queueId, idempotencyKey)',
      retryPolicies: ['FIXED', 'LINEAR', 'EXPONENTIAL'],
      deadLetterQueue: 'Persistent DLQ with failure context & manual/automatic replay',
    },
  });
});
