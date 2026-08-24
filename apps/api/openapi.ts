export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Distributed Job Scheduler API',
    version: '1.0.0',
    description: 'Production-grade distributed job scheduler REST API with tenant isolation, atomic claiming, lease crash recovery, and queue concurrency enforcement.',
  },
  servers: [
    {
      url: '/api',
      description: 'Default API Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Job: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          queueId: { type: 'string', format: 'uuid' },
          idempotencyKey: { type: 'string', nullable: true },
          type: { type: 'string', enum: ['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'CRON', 'BATCH'] },
          status: { type: 'string', enum: ['QUEUED', 'SCHEDULED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] },
          priority: { type: 'integer' },
          payload: { type: 'object' },
          result: { type: 'object', nullable: true },
          attemptCount: { type: 'integer' },
          maxAttempts: { type: 'integer' },
          scheduledAt: { type: 'string', format: 'date-time' },
          version: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Queue: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          priority: { type: 'integer' },
          concurrencyLimit: { type: 'integer' },
          isPaused: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Worker: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          hostname: { type: 'string' },
          processId: { type: 'integer' },
          status: { type: 'string', enum: ['ACTIVE', 'DRAINING', 'STOPPED', 'DEAD'] },
          concurrency: { type: 'integer' },
          activeJobsCount: { type: 'integer' },
          lastHeartbeatAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'System health check',
        responses: {
          200: { description: 'Healthy' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register new user',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User registered' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'User login',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authentication successful with JWT token' },
        },
      },
    },
    '/jobs': {
      post: {
        summary: 'Enqueue a new job with idempotency support',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Job created' },
        },
      },
      get: {
        summary: 'List and filter jobs',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of jobs' },
        },
      },
    },
    '/queues': {
      get: {
        summary: 'List project queues',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of queues' },
        },
      },
    },
    '/workers': {
      get: {
        summary: 'List active and registered workers',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Worker fleet status' },
        },
      },
    },
  },
};
