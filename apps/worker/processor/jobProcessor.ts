import prisma from '../../../src/db/prisma.ts';
import { WorkerConfig, ClaimedJobContext } from '../types.ts';
import { ClaimService } from './claimService.ts';
import { JobExecutor } from './executor.ts';
import { calculateBackoffDelay, canRetryJob, DEFAULT_RETRY_POLICY, RetryPolicyConfig } from './retryPolicy.ts';
import { LeaseManager } from '../lease/leaseManager.ts';

export class JobProcessor {
  private config: WorkerConfig;
  private isShuttingDown = false;
  private leaseManager?: LeaseManager;
  private workerDbId: string;

  constructor(config: WorkerConfig, leaseManager?: LeaseManager) {
    this.config = config;
    this.workerDbId = config.workerDbId || config.workerId;
    this.leaseManager = leaseManager;
  }

  public setWorkerDbId(id: string) {
    this.workerDbId = id;
  }

  public setShuttingDown(val: boolean) {
    this.isShuttingDown = val;
  }

  public async claimNextJobs(availableSlots: number, queueIds?: string[]): Promise<ClaimedJobContext[]> {
    if (this.isShuttingDown || availableSlots <= 0) {
      return [];
    }

    const claimed = await ClaimService.claimJobs(
      this.workerDbId,
      availableSlots,
      this.config.leaseDurationSeconds,
      queueIds
    );

    if (this.leaseManager) {
      for (const job of claimed) {
        this.leaseManager.registerJob(job.jobId);
      }
    }

    return claimed;
  }

  public async processJob(jobCtx: ClaimedJobContext): Promise<void> {
    const startTime = Date.now();
    let executionId: string | null = null;

    try {
      // 1. Transition CLAIMED -> RUNNING with version validation
      const runningJob = await prisma.job.updateMany({
        where: {
          id: jobCtx.jobId,
          version: jobCtx.version,
          lockedByWorkerId: this.workerDbId,
          status: 'CLAIMED',
        },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (runningJob.count === 0) {
        console.warn(
          `[JobProcessor] Failed to transition job ${jobCtx.jobId} to RUNNING. Lost lease or version mismatch.`
        );
        if (this.leaseManager) {
          this.leaseManager.unregisterJob(jobCtx.jobId);
        }
        return;
      }

      // 2. Create JobExecution record
      const execution = await prisma.jobExecution.create({
        data: {
          jobId: jobCtx.jobId,
          workerId: this.workerDbId,
          attemptNumber: jobCtx.attemptNumber,
          status: 'RUNNING',
          startedAt: new Date(),
          workerMetadata: {
            workerId: this.config.workerId,
            hostname: this.config.hostname,
            processId: this.config.processId,
          },
        },
      });
      executionId = execution.id;

      // 3. Log JOB_STARTED
      await prisma.jobLog.create({
        data: {
          jobId: jobCtx.jobId,
          executionId: execution.id,
          level: 'INFO',
          message: `Job started (attempt ${jobCtx.attemptNumber})`,
          metadata: {
            attemptNumber: jobCtx.attemptNumber,
            type: jobCtx.type,
          },
        },
      });

      // 4. Execute deterministic job handler
      const execResult = await JobExecutor.execute({
        jobId: jobCtx.jobId,
        attemptNumber: jobCtx.attemptNumber,
        type: jobCtx.type,
        payload: jobCtx.payload,
      });

      const durationMs = Date.now() - startTime;

      if (execResult.success) {
        // 5a. Succeeded: RUNNING -> COMPLETED
        await prisma.job.updateMany({
          where: {
            id: jobCtx.jobId,
            lockedByWorkerId: this.workerDbId,
            status: 'RUNNING',
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            result: (execResult.result as any) || {},
            errorMessage: null,
            lockedByWorkerId: null,
            lockedAt: null,
            leaseExpiresAt: null,
            version: { increment: 1 },
          },
        });

        // Update execution record
        await prisma.jobExecution.update({
          where: { id: execution.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            durationMs,
            result: (execResult.result as any) || {},
          },
        });

        // Log JOB_COMPLETED
        await prisma.jobLog.create({
          data: {
            jobId: jobCtx.jobId,
            executionId: execution.id,
            level: 'INFO',
            message: `Job completed successfully in ${durationMs}ms`,
            metadata: {
              durationMs,
              result: (execResult.result as any) || {},
            },
          },
        });

      } else {
        // 5b. Failed execution
        await this.handleJobFailure(
          jobCtx,
          execution.id,
          execResult.errorMessage || 'Unknown execution error',
          durationMs
        );
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.handleJobFailure(jobCtx, executionId, errorMsg, durationMs);
    } finally {
      if (this.leaseManager) {
        this.leaseManager.unregisterJob(jobCtx.jobId);
      }
    }
  }

  private async handleJobFailure(
    jobCtx: ClaimedJobContext,
    executionId: string | null,
    errorMessage: string,
    durationMs: number
  ): Promise<void> {
    try {
      // 1. Mark JobExecution as FAILED
      if (executionId) {
        await prisma.jobExecution.update({
          where: { id: executionId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            durationMs,
            errorMessage,
          },
        });

        await prisma.jobLog.create({
          data: {
            jobId: jobCtx.jobId,
            executionId,
            level: 'ERROR',
            message: `Job execution failed: ${errorMessage}`,
            metadata: {
              attemptNumber: jobCtx.attemptNumber,
              durationMs,
              errorMessage,
            },
          },
        });
      }

      // 2. Fetch retry policy for queue / job
      let policyConfig: RetryPolicyConfig = DEFAULT_RETRY_POLICY;

      if (jobCtx.retryPolicyId) {
        const policy = await prisma.retryPolicy.findUnique({
          where: { id: jobCtx.retryPolicyId },
        });
        if (policy) {
          policyConfig = {
            strategy: policy.strategy,
            baseDelayMs: policy.baseDelayMs,
            maxDelayMs: policy.maxDelayMs,
            maxAttempts: policy.maxAttempts,
            backoffFactor: policy.backoffFactor,
          };
        }
      } else {
        // Check Queue's default retry policy
        const queue = await prisma.queue.findUnique({
          where: { id: jobCtx.queueId },
          include: { retryPolicy: true },
        });
        if (queue?.retryPolicy) {
          policyConfig = {
            strategy: queue.retryPolicy.strategy,
            baseDelayMs: queue.retryPolicy.baseDelayMs,
            maxDelayMs: queue.retryPolicy.maxDelayMs,
            maxAttempts: queue.retryPolicy.maxAttempts,
            backoffFactor: queue.retryPolicy.backoffFactor,
          };
        }
      }

      const effectiveMaxAttempts = jobCtx.maxAttempts || policyConfig.maxAttempts;
      const canRetry = canRetryJob(jobCtx.attemptNumber, effectiveMaxAttempts);

      if (canRetry) {
        // Calculate backoff delay
        const delayMs = calculateBackoffDelay(jobCtx.attemptNumber, policyConfig);
        const nextScheduledAt = new Date(Date.now() + delayMs);

        // Transition RUNNING -> SCHEDULED
        await prisma.job.updateMany({
          where: {
            id: jobCtx.jobId,
            lockedByWorkerId: this.workerDbId,
            status: 'RUNNING',
          },
          data: {
            status: 'SCHEDULED',
            scheduledAt: nextScheduledAt,
            errorMessage,
            lockedByWorkerId: null,
            lockedAt: null,
            leaseExpiresAt: null,
            version: { increment: 1 },
          },
        });

        // Log RETRY_SCHEDULED
        await prisma.jobLog.create({
          data: {
            jobId: jobCtx.jobId,
            executionId: executionId || undefined,
            level: 'WARN',
            message: `Retry scheduled for attempt ${jobCtx.attemptNumber + 1}/${effectiveMaxAttempts} in ${delayMs}ms`,
            metadata: {
              attemptNumber: jobCtx.attemptNumber,
              maxAttempts: effectiveMaxAttempts,
              delayMs,
              scheduledAt: nextScheduledAt.toISOString(),
              strategy: policyConfig.strategy,
            },
          },
        });
      } else {
        // Attempts exhausted: RUNNING -> FAILED & Dead Letter Queue
        await prisma.job.updateMany({
          where: {
            id: jobCtx.jobId,
            lockedByWorkerId: this.workerDbId,
            status: 'RUNNING',
          },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage,
            lockedByWorkerId: null,
            lockedAt: null,
            leaseExpiresAt: null,
            version: { increment: 1 },
          },
        });

        // Upsert into DeadLetterJob
        await prisma.deadLetterJob.upsert({
          where: { jobId: jobCtx.jobId },
          create: {
            jobId: jobCtx.jobId,
            queueId: jobCtx.queueId,
            originalPayload: (jobCtx.payload as any) || {},
            failureReason: 'MAX_ATTEMPTS_EXCEEDED',
            errorMessage,
            finalAttemptCount: jobCtx.attemptNumber,
            status: 'UNRESOLVED',
            failedAt: new Date(),
          },
          update: {
            failureReason: 'MAX_ATTEMPTS_EXCEEDED',
            errorMessage,
            finalAttemptCount: jobCtx.attemptNumber,
            status: 'UNRESOLVED',
            failedAt: new Date(),
          },
        });

        // Log JOB_FAILED and DLQ event
        await prisma.jobLog.create({
          data: {
            jobId: jobCtx.jobId,
            executionId: executionId || undefined,
            level: 'ERROR',
            message: `Max retry attempts (${effectiveMaxAttempts}) exhausted. Moved to Dead Letter Queue.`,
            metadata: {
              finalAttemptCount: jobCtx.attemptNumber,
              maxAttempts: effectiveMaxAttempts,
              errorMessage,
            },
          },
        });
      }
    } catch (failureHandlingErr) {
      console.error(
        `[JobProcessor] Error during failure handling for job ${jobCtx.jobId}:`,
        failureHandlingErr
      );
    }
  }
}
