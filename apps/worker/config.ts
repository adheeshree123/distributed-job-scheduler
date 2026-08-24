import os from 'os';
import crypto from 'crypto';
import { WorkerConfig } from './types.ts';

export function getWorkerConfig(): WorkerConfig {
  const hostname = os.hostname();
  const processId = process.pid;
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const workerId = process.env.WORKER_ID || `worker-${hostname}-${processId}-${randomSuffix}`;

  return {
    workerId,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    pollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '1000', 10),
    heartbeatIntervalMs: parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS || '5000', 10),
    leaseDurationSeconds: parseInt(process.env.WORKER_LEASE_DURATION_SECONDS || '30', 10),
    hostname,
    processId,
  };
}
