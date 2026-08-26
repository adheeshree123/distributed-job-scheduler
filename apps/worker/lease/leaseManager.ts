import os from 'os';
import prisma from '../../../src/db/prisma.ts';
import { WorkerConfig } from '../types.ts';

export class LeaseManager {
  private activeJobIds = new Set<string>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private config: WorkerConfig;
  private workerDbId: string;

  constructor(config: WorkerConfig) {
    this.config = config;
    this.workerDbId = config.workerDbId || config.workerId;
  }

  public setWorkerDbId(id: string) {
    this.workerDbId = id;
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

  public getActiveJobIds(): string[] {
    return Array.from(this.activeJobIds);
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
    try {
      const memUsage = process.memoryUsage();
      const memoryUsageMb = Math.round((memUsage.heapUsed / (1024 * 1024)) * 100) / 100;
      const loadAvg = os.loadavg();
      const cpuUsagePct = Math.round((loadAvg[0] || 0) * 100) / 100;
      const activeCount = this.activeJobIds.size;

      // 1. Update Worker state
      await prisma.worker.updateMany({
        where: { id: this.workerDbId },
        data: {
          lastHeartbeatAt: new Date(),
          activeJobsCount: activeCount,
          status: 'ONLINE',
        },
      });

      // 2. Persist WorkerHeartbeat record
      await prisma.workerHeartbeat.create({
        data: {
          workerId: this.workerDbId,
          activeJobsCount: activeCount,
          cpuUsagePct,
          memoryUsageMb,
          systemLoad: {
            loadAvg1m: loadAvg[0] || 0,
            loadAvg5m: loadAvg[1] || 0,
            loadAvg15m: loadAvg[2] || 0,
            totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
            freeMemMb: Math.round(os.freemem() / (1024 * 1024)),
          },
        },
      });

      // 3. Extend leases for all active jobs currently owned by this worker
      const activeIds = Array.from(this.activeJobIds);
      if (activeIds.length > 0) {
        const leaseDurationSec = this.config.leaseDurationSeconds || 30;
        await prisma.$executeRawUnsafe(
          `UPDATE "Job"
           SET "leaseExpiresAt" = NOW() + ($1 || ' seconds')::INTERVAL,
               "updatedAt" = NOW()
           WHERE id = ANY($2::text[])
             AND "lockedByWorkerId" = $3
             AND "status" IN ('CLAIMED', 'RUNNING');`,
          leaseDurationSec,
          activeIds,
          this.workerDbId
        );
      }
    } catch (err) {
      console.warn(`[LeaseManager] Heartbeat / lease renewal warning for worker ${this.workerDbId}:`, err);
    }
  }
}
