import { z } from 'zod';
import { JobType, RetryStrategy, OrganizationRole } from '@prisma/client';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens')
    .optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const createProjectSchema = z.object({
  organizationId: z.string().uuid('Valid organization ID is required'),
  name: z.string().min(2, 'Project name must be at least 2 characters').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(500).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(500).nullable().optional(),
});

export const createQueueSchema = z.object({
  name: z.string().min(2, 'Queue name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  priority: z.number().int().min(-100).max(100).default(0),
  concurrencyLimit: z.number().int().min(1, 'Concurrency limit must be at least 1').max(1000).default(10),
  retryPolicyId: z.string().uuid().optional().nullable(),
});

export const updateQueueSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  priority: z.number().int().min(-100).max(100).optional(),
  concurrencyLimit: z.number().int().min(1).max(1000).optional(),
  retryPolicyId: z.string().uuid().nullable().optional(),
});

export const singleJobItemSchema = z.object({
  type: z.nativeEnum(JobType).optional().default(JobType.IMMEDIATE),
  priority: z.number().int().min(-100).max(100).default(0),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  idempotencyKey: z.string().min(1).max(255).optional(),
  scheduledAt: z.string().datetime().or(z.date()).optional(),
  delayMs: z.number().int().min(0).optional(),
  maxAttempts: z.number().int().min(1).max(20).optional().default(3),
  retryPolicyId: z.string().uuid().optional().nullable(),
  cronExpression: z.string().min(5).max(100).optional(),
  timezone: z.string().default('UTC').optional(),
});

export const createJobSchema = z.union([
  z.object({
    jobs: z.array(singleJobItemSchema).min(1, 'Batch must contain at least 1 job').max(500, 'Batch maximum is 500 jobs'),
  }),
  singleJobItemSchema,
]);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateQueueInput = z.infer<typeof createQueueSchema>;
export type UpdateQueueInput = z.infer<typeof updateQueueSchema>;
export type SingleJobItemInput = z.infer<typeof singleJobItemSchema>;
