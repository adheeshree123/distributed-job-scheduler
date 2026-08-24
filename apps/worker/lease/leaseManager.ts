import { WorkerConfig } from '../types.ts';

export class LeaseManager {
  private activeJobIds = new Set<string>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  public registerJob(jobId: string): void {
    this.activeJobIds.add(jobId);
  }

  public unregisterJob(jobId: string): void {
    this.activeJobIds.delete(jobId);
  }

  public getActiveJobCount(): number {
    return this.activeJobIds.size;
  }

  public startHeartbeatLoop(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(async () => {
      await this.sendHeartbeatAndExtendLeases();
    }, this.config.heartbeatIntervalMs);
  }

  public stopHeartbeatLoop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public async sendHeartbeatAndExtendLeases(): Promise<void> {
    // Skeleton implementation:
    // 1. Sends worker heartbeat with active count & memory/CPU
    // 2. Extends lockedAt & leaseExpiresAt on all activeJobIds in PostgreSQL
  }
}
