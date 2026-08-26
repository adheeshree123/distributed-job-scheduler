import prisma from '../../src/db/prisma.ts';
import { getWorkerConfig } from './config.ts';
import { LeaseManager } from './lease/leaseManager.ts';
import { JobProcessor } from './processor/jobProcessor.ts';
import { CrashRecoveryManager } from './recovery/crashRecovery.ts';
import { CronDispatcher } from './scheduler/cronDispatcher.ts';

export class WorkerService {
  public config = getWorkerConfig();
  public leaseManager = new LeaseManager(this.config);
  public processor: JobProcessor;
  public recovery = new CrashRecoveryManager(15000);
  public cronDispatcher = new CronDispatcher(1000);

  private isRunning = false;
  private isDraining = false;
  private activeExecutions = new Set<Promise<void>>();
  private pollTimer: NodeJS.Timeout | null = null;
  public workerDbId: string = '';

  constructor(customConfig?: Partial<ReturnType<typeof getWorkerConfig>>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
      this.leaseManager = new LeaseManager(this.config);
    }
    this.processor = new JobProcessor(this.config, this.leaseManager);
  }

  public async start(options?: { autoPoll?: boolean; backgroundLoops?: boolean }): Promise<void> {
    const autoPoll = options?.autoPoll ?? true;
    const backgroundLoops = options?.backgroundLoops ?? true;

    // 1. Register worker identity in PostgreSQL
    const workerRecord = await prisma.worker.upsert({
      where: { workerId: this.config.workerId },
      create: {
        workerId: this.config.workerId,
        hostname: this.config.hostname,
        processId: this.config.processId,
        status: 'ONLINE',
        concurrency: this.config.concurrency,
        activeJobsCount: 0,
        lastHeartbeatAt: new Date(),
        startedAt: new Date(),
        metadata: {
          nodeVersion: process.version,
          platform: process.platform,
        },
      },
      update: {
        hostname: this.config.hostname,
        processId: this.config.processId,
        status: 'ONLINE',
        concurrency: this.config.concurrency,
        activeJobsCount: 0,
        lastHeartbeatAt: new Date(),
        stoppedAt: null,
      },
    });

    this.workerDbId = workerRecord.id;
    this.config.workerDbId = workerRecord.id;
    this.processor.setWorkerDbId(workerRecord.id);
    this.leaseManager.setWorkerDbId(workerRecord.id);

    console.log(`[Worker Service] Worker registered: ${this.config.workerId} (DB ID: ${this.workerDbId})`);
    console.log(`[Worker Service] Concurrency: ${this.config.concurrency}, Lease Duration: ${this.config.leaseDurationSeconds}s`);

    this.isRunning = true;
    this.isDraining = false;

    // 2. Start background heartbeat, recovery, and cron loops
    if (backgroundLoops) {
      this.leaseManager.startHeartbeatLoop();
      this.recovery.start();
      this.cronDispatcher.start();
    }

    // 3. Start job polling loop
    if (autoPoll) {
      this.scheduleNextPoll(0);
    }

    // 4. Hook termination signals
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
  }

  private scheduleNextPoll(delayMs: number): void {
    if (!this.isRunning || this.isDraining) return;
    this.pollTimer = setTimeout(async () => {
      await this.pollAndExecute();
      this.scheduleNextPoll(this.config.pollIntervalMs);
    }, delayMs);
  }

  public async pollAndExecute(): Promise<number> {
    if (!this.isRunning || this.isDraining) return 0;

    const availableSlots = this.config.concurrency - this.activeExecutions.size;
    if (availableSlots <= 0) {
      return 0;
    }

    try {
      const claimedJobs = await this.processor.claimNextJobs(availableSlots);
      if (claimedJobs.length === 0) {
        return 0;
      }

      for (const job of claimedJobs) {
        const executionPromise = (async () => {
          try {
            await this.processor.processJob(job);
          } catch (err) {
            console.error(`[Worker Service] Error executing job ${job.jobId}:`, err);
          } finally {
            this.activeExecutions.delete(executionPromise);
          }
        })();

        this.activeExecutions.add(executionPromise);
      }

      return claimedJobs.length;
    } catch (err) {
      console.error('[Worker Service] Polling error:', err);
      return 0;
    }
  }

  public async shutdown(signal = 'SIGTERM'): Promise<void> {
    console.log(`[Worker Service] Received ${signal}. Starting graceful shutdown...`);
    this.isRunning = false;
    this.isDraining = true;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    this.processor.setShuttingDown(true);
    this.recovery.stop();
    this.cronDispatcher.stop();

    // Mark worker as DRAINING in DB
    if (this.workerDbId) {
      try {
        await prisma.worker.update({
          where: { id: this.workerDbId },
          data: { status: 'DRAINING' },
        });
      } catch (_) {}
    }

    // Wait for in-flight jobs to complete (with safety timeout)
    if (this.activeExecutions.size > 0) {
      console.log(`[Worker Service] Waiting for ${this.activeExecutions.size} active execution(s) to finish...`);
      await Promise.race([
        Promise.all(Array.from(this.activeExecutions)),
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ]);
    }

    this.leaseManager.stopHeartbeatLoop();

    // Mark worker as OFFLINE in DB
    if (this.workerDbId) {
      try {
        await prisma.worker.update({
          where: { id: this.workerDbId },
          data: {
            status: 'OFFLINE',
            stoppedAt: new Date(),
            activeJobsCount: 0,
          },
        });
      } catch (_) {}
    }

    console.log(`[Worker Service] Worker ${this.config.workerId} cleanly shut down.`);
  }

  public getActiveCount(): number {
    return this.activeExecutions.size;
  }
}

// Standalone worker runner if executed directly
if (process.argv[1]?.endsWith('main.ts') || process.env.RUN_WORKER === 'true') {
  const service = new WorkerService();
  service.start().catch((err) => {
    console.error('[Worker Fatal Error]:', err);
    process.exit(1);
  });
}
