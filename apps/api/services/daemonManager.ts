import { WorkerService } from '../../worker/main.ts';
import prisma from '../../../src/db/prisma.ts';

class DaemonManager {
  private activeWorkers: Map<string, WorkerService> = new Map();
  private primaryWorker: WorkerService | null = null;

  constructor() {
    // Lazy initialisation or auto-start on first demand
  }

  public async getStatus() {
    const dbWorkers = await prisma.worker.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const isRunning = this.primaryWorker !== null;
    const activeExecutionsCount = this.primaryWorker ? this.primaryWorker.getActiveCount() : 0;
    const primaryWorkerId = this.primaryWorker ? this.primaryWorker.config.workerId : null;

    return {
      daemonRunning: isRunning,
      primaryWorkerId,
      activeExecutionsCount,
      totalActiveDaemons: this.activeWorkers.size,
      dbWorkersCount: dbWorkers.length,
      onlineWorkersCount: dbWorkers.filter((w) => w.status === 'ONLINE').length,
    };
  }

  public async startPrimaryWorker(options?: { concurrency?: number; pollIntervalMs?: number }) {
    if (this.primaryWorker) {
      return {
        success: true,
        message: 'Worker is already running',
        workerId: this.primaryWorker.config.workerId,
      };
    }

    const worker = new WorkerService({
      workerId: `worker-daemon-${Math.floor(1000 + Math.random() * 9000)}`,
      concurrency: options?.concurrency ?? 5,
      pollIntervalMs: options?.pollIntervalMs ?? 1500,
    });

    await worker.start({ autoPoll: true, backgroundLoops: true });
    this.primaryWorker = worker;
    this.activeWorkers.set(worker.config.workerId, worker);

    return {
      success: true,
      message: 'Worker daemon started successfully',
      workerId: worker.config.workerId,
    };
  }

  public async stopPrimaryWorker() {
    if (!this.primaryWorker) {
      return {
        success: true,
        message: 'No worker daemon is currently running',
      };
    }

    const workerId = this.primaryWorker.config.workerId;
    const worker = this.primaryWorker;
    this.primaryWorker = null;
    this.activeWorkers.delete(workerId);

    await worker.shutdown('USER_REQUEST');

    return {
      success: true,
      message: `Worker daemon ${workerId} stopped successfully`,
      workerId,
    };
  }

  public async pollOnce() {
    let worker = this.primaryWorker;
    if (!worker) {
      // If primary worker is not running in auto-poll mode, create a transient or start single-step worker
      worker = new WorkerService({
        workerId: `worker-step-${Math.floor(1000 + Math.random() * 9000)}`,
        concurrency: 5,
      });
      await worker.start({ autoPoll: false, backgroundLoops: false });
    }

    const processed = await worker.pollAndExecute();
    return {
      success: true,
      claimedCount: processed,
      workerId: worker.config.workerId,
      message: processed > 0 ? `Worker claimed and processed ${processed} job(s)` : 'No eligible queued jobs found',
    };
  }

  public async spawnSecondaryWorker() {
    const worker = new WorkerService({
      workerId: `worker-fleet-${Math.floor(1000 + Math.random() * 9000)}`,
      concurrency: 5,
      pollIntervalMs: 1500,
    });

    await worker.start({ autoPoll: true, backgroundLoops: true });
    this.activeWorkers.set(worker.config.workerId, worker);

    return {
      success: true,
      message: `Secondary worker ${worker.config.workerId} spawned into fleet`,
      workerId: worker.config.workerId,
    };
  }

  public async stopAll() {
    for (const [id, worker] of this.activeWorkers.entries()) {
      try {
        await worker.shutdown('STOP_ALL');
      } catch (err) {
        console.error(`Error stopping worker ${id}:`, err);
      }
    }
    this.activeWorkers.clear();
    this.primaryWorker = null;
  }
}

export const DaemonManagerService = new DaemonManager();
