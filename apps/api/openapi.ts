export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Distributed Job Scheduler API',
    version: '1.0.0',
    description:
      'Production-grade distributed job scheduler REST API with multi-tenant isolation, organization/project scoping, queue lifecycle controls, atomic batch transactions, scheduled/cron jobs, and idempotency guarantees.',
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
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          organizationId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Queue: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          priority: { type: 'integer' },
          concurrencyLimit: { type: 'integer' },
          isPaused: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Job: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          queueId: { type: 'string', format: 'uuid' },
          idempotencyKey: { type: 'string', nullable: true },
          type: { type: 'string', enum: ['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'CRON', 'BATCH'] },
          status: {
            type: 'string',
            enum: ['QUEUED', 'SCHEDULED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
          },
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
      Worker: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          hostname: { type: 'string' },
          processId: { type: 'integer' },
          status: { type: 'string', enum: ['ONLINE', 'DRAINING', 'OFFLINE'] },
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
    '/info': {
      get: {
        summary: 'System architecture diagnostics',
        responses: {
          200: { description: 'System info' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register new user account',
        requestBody: {
          required: true,
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
          201: { description: 'User successfully registered with JWT token' },
          409: { description: 'Email already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate with email & password',
        requestBody: {
          required: true,
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
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current authenticated user profile & tenant memberships',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current user profile' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/organizations': {
      post: {
        summary: 'Create a new organization (caller becomes OWNER)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Organization created' },
        },
      },
      get: {
        summary: 'List organizations where caller is a member',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of organizations' },
        },
      },
    },
    '/organizations/{id}': {
      get: {
        summary: 'Get organization details & project list',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Organization details' },
          404: { description: 'Not found or access denied' },
        },
      },
      patch: {
        summary: 'Update organization name or slug (OWNER/ADMIN only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Organization updated' },
          403: { description: 'Insufficient permissions' },
        },
      },
    },
    '/projects': {
      post: {
        summary: 'Create project within organization (OWNER/ADMIN only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['organizationId', 'name'],
                properties: {
                  organizationId: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Project created' },
          403: { description: 'Insufficient permissions' },
          404: { description: 'Organization not found' },
        },
      },
      get: {
        summary: 'List projects in tenant organizations',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'query', name: 'organizationId', schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'List of projects' },
        },
      },
    },
    '/projects/{id}': {
      get: {
        summary: 'Get project details and queues',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Project details' },
          404: { description: 'Project not found or access denied' },
        },
      },
      patch: {
        summary: 'Update project settings (OWNER/ADMIN only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Project updated' },
          403: { description: 'Insufficient permissions' },
        },
      },
      delete: {
        summary: 'Delete project and all associated queues & jobs (OWNER only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Project deleted' },
          403: { description: 'Insufficient permissions' },
        },
      },
    },
    '/projects/{projectId}/queues': {
      post: {
        summary: 'Create a new queue under project (OWNER/ADMIN only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'projectId', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  priority: { type: 'integer', default: 0 },
                  concurrencyLimit: { type: 'integer', default: 10 },
                  retryPolicyId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Queue created' },
          409: { description: 'Queue name already exists in project' },
        },
      },
      get: {
        summary: 'List queues in project with pagination & counts',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'projectId', required: true, schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'List of queues' },
        },
      },
    },
    '/queues/{id}': {
      get: {
        summary: 'Get queue details and status summary',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Queue details' },
          404: { description: 'Queue not found or access denied' },
        },
      },
      patch: {
        summary: 'Update queue concurrency, priority, retry policy (OWNER/ADMIN only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Queue updated' },
        },
      },
      delete: {
        summary: 'Delete queue and all child jobs (OWNER only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Queue deleted' },
        },
      },
    },
    '/queues/{id}/pause': {
      post: {
        summary: 'Pause queue consumption (OWNER/ADMIN only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Queue paused' },
        },
      },
    },
    '/queues/{id}/resume': {
      post: {
        summary: 'Resume paused queue consumption (OWNER/ADMIN only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Queue resumed' },
        },
      },
    },
    '/queues/{id}/stats': {
      get: {
        summary: 'Get aggregate status distribution, throughput & DLQ statistics',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Queue statistics' },
        },
      },
    },
    '/queues/{queueId}/jobs': {
      post: {
        summary: 'Submit immediate, delayed, scheduled, cron, or batch jobs with idempotency protection',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'queueId', required: true, schema: { type: 'string', format: 'uuid' } },
          { in: 'header', name: 'Idempotency-Key', schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['IMMEDIATE', 'DELAYED', 'SCHEDULED', 'CRON', 'BATCH'] },
                  priority: { type: 'integer', default: 0 },
                  payload: { type: 'object' },
                  idempotencyKey: { type: 'string' },
                  delayMs: { type: 'integer' },
                  scheduledAt: { type: 'string', format: 'date-time' },
                  cronExpression: { type: 'string' },
                  maxAttempts: { type: 'integer', default: 3 },
                  jobs: {
                    type: 'array',
                    description: 'Array of jobs for atomic batch creation',
                    items: { type: 'object' },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Job created' },
          200: { description: 'Idempotent replay of existing job' },
          400: { description: 'Validation error' },
        },
      },
      get: {
        summary: 'List and filter jobs in queue with pagination',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'queueId', required: true, schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'type', schema: { type: 'string' } },
          { in: 'query', name: 'priority', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Paginated job list' },
        },
      },
    },
    '/jobs/{id}': {
      get: {
        summary: 'Inspect job status, executions, logs, and DLQ state',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Job details with execution attempt history' },
          404: { description: 'Job not found or cross-tenant access denied' },
        },
      },
    },
  },
};
