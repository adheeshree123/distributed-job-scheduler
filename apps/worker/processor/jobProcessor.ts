import { WorkerConfig, ClaimedJobContext } from '../types.ts';

export class JobProcessor {
  private config: WorkerConfig;
  private isShuttingDown = false;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  public setShuttingDown(val: boolean) {
    this.isShuttingDown = val;
  }

  public async claimNextJobs(availableSlots: number): Promise<ClaimedJobContext[]> {
    if (this.isShuttingDown || availableSlots <= 0) {
      return [];
    }
    // Claim logic skeleton using PostgreSQL SELECT ... FOR UPDATE SKIP LOCKED
    return [];
  }

  public async processJob(jobCtx: ClaimedJobContext): Promise<void> {
    // Process single job, record execution, and update status
  }
}
