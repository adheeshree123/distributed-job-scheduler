import { getWorkerConfig } from './config.ts';
import { LeaseManager } from './lease/leaseManager.ts';
import { JobProcessor } from './processor/jobProcessor.ts';
import { CrashRecoveryManager } from './recovery/crashRecovery.ts';

export class WorkerService {
  private config = getWorkerConfig();
  private leaseManager = new LeaseManager(this.config);
  private processor = new JobProcessor(this.config);
  private recovery = new CrashRecoveryManager();
  private isRunning = false;

  public async start(): Promise<void> {
    console.log(`[Worker Service] Initializing worker: ${this.config.workerId}`);
    console.log(`[Worker Service] Concurrency limit: ${this.config.concurrency}`);
    console.log(`[Worker Service] Lease duration: ${this.config.leaseDurationSeconds}s`);

    this.isRunning = true;
    this.leaseManager.startHeartbeatLoop();
    this.recovery.start();

    // Hook graceful shutdown handlers
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
  }

  public async shutdown(signal: string): Promise<void> {
    console.log(`[Worker Service] Received ${signal}. Starting graceful shutdown...`);
    this.isRunning = false;
    this.processor.setShuttingDown(true);
    this.recovery.stop();
    this.leaseManager.stopHeartbeatLoop();
    console.log(`[Worker Service] Worker ${this.config.workerId} shut down cleanly.`);
  }
}

// Allow standalone execution when run directly: `tsx apps/worker/main.ts`
if (process.argv[1]?.endsWith('main.ts') || process.env.RUN_WORKER === 'true') {
  const service = new WorkerService();
  service.start().catch((err) => {
    console.error('[Worker Fatal Error]:', err);
    process.exit(1);
  });
}
