export type JobStatus =
  | 'QUEUED'
  | 'SCHEDULED'
  | 'CLAIMED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type JobType = 'IMMEDIATE' | 'DELAYED' | 'SCHEDULED' | 'CRON' | 'BATCH';

export type RetryStrategy = 'FIXED' | 'LINEAR' | 'EXPONENTIAL';

export type WorkerStatus = 'ONLINE' | 'DRAINING' | 'OFFLINE';

export type DLQStatus = 'UNRESOLVED' | 'RETRIED' | 'DISCARDED';

export interface RetryPolicy {
  id: string;
  name: string;
  strategy: RetryStrategy;
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  backoffFactor: number;
  createdAt: string;
  updatedAt: string;
}

export interface Queue {
  id: string;
  projectId: string;
  retryPolicyId?: string | null;
  name: string;
  description?: string | null;
  priority: number;
  concurrencyLimit: number;
  isPaused: boolean;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    name: string;
    slug: string;
    organization?: {
      id: string;
      name: string;
    };
  };
  retryPolicy?: RetryPolicy | null;
  stats?: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    dlq: number;
    total: number;
  };
  _count?: {
    jobs: number;
    deadLetterJobs: number;
    scheduledJobs: number;
  };
}

export interface WorkerInfo {
  id: string;
  workerId: string;
  hostname: string;
  processId?: number;
  status: WorkerStatus;
  startedAt: string;
  lastHeartbeatAt: string;
  drainingSince?: string | null;
  stoppedAt?: string | null;
  _count?: {
    executions: number;
    heartbeats: number;
  };
}

export interface JobLog {
  id: string;
  jobId: string;
  level: string;
  message: string;
  metadata?: any;
  timestamp: string;
}

export interface JobExecution {
  id: string;
  jobId: string;
  workerId: string;
  attemptNumber: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  error?: string | null;
  worker?: {
    id: string;
    workerId: string;
    hostname: string;
  };
  logs?: JobLog[];
}

export interface DeadLetterJob {
  id: string;
  jobId: string;
  queueId: string;
  reason: string;
  attemptsCount: number;
  status: DLQStatus;
  failedAt: string;
  retriedAt?: string | null;
  discardedAt?: string | null;
  job?: Job;
  queue?: Queue;
}

export interface Job {
  id: string;
  queueId: string;
  retryPolicyId?: string | null;
  idempotencyKey?: string | null;
  type: JobType;
  status: JobStatus;
  priority: number;
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  errorMessage?: string | null;
  attemptCount: number;
  maxAttempts: number;
  scheduledAt: string;
  lockedAt?: string | null;
  leaseExpiresAt?: string | null;
  lockedByWorkerId?: string | null;
  version: number;
  batchId?: string | null;
  parentJobId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  queue?: Queue;
  retryPolicy?: RetryPolicy | null;
  lockedByWorker?: WorkerInfo | null;
  deadLetterJob?: DeadLetterJob | null;
  executions?: JobExecution[];
  logs?: JobLog[];
  _count?: {
    executions: number;
    logs: number;
  };
}

export interface DashboardMetrics {
  totalJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  dlqJobs: number;
  activeWorkers: number;
}

export interface WorkerDaemonStatus {
  daemonRunning: boolean;
  primaryWorkerId: string | null;
  activeExecutionsCount: number;
  totalActiveDaemons: number;
  dbWorkersCount: number;
  onlineWorkersCount: number;
}

export interface ScheduledJob {
  id: string;
  projectId: string;
  queueId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  payload: Record<string, any>;
  priority: number;
  nextRunAt: string;
  lastRunAt?: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  queue?: Queue;
}
