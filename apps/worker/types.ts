export interface WorkerConfig {
  workerId: string;
  workerDbId?: string;
  concurrency: number;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  leaseDurationSeconds: number;
  hostname: string;
  processId: number;
}

export interface ClaimedJobContext {
  jobId: string;
  queueId: string;
  type: string;
  attemptNumber: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  retryPolicyId?: string | null;
  leaseExpiresAt: Date;
  version: number;
}

