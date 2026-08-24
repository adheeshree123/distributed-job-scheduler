export interface WorkerConfig {
  workerId: string;
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
  attemptNumber: number;
  payload: Record<string, unknown>;
  leaseExpiresAt: Date;
  version: number;
}
