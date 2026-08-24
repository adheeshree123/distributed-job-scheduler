import { JobStatus, JobType, OrgRole, RetryStrategy, WorkerStatus } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface TenantContext {
  userId: string;
  organizationId: string;
  role: OrgRole;
  projectId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface CreateJobInput {
  queueId: string;
  type?: JobType;
  priority?: number;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  scheduledAt?: string | Date;
  maxAttempts?: number;
}

export interface BatchCreateJobInput {
  queueId: string;
  jobs: Array<{
    type?: JobType;
    priority?: number;
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
    scheduledAt?: string | Date;
  }>;
}

export interface WorkerHeartbeatPayload {
  workerId: string;
  activeJobsCount: number;
  cpuUsagePct?: number;
  memoryUsageMb?: number;
  systemLoad?: Record<string, unknown>;
}
