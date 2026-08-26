import prisma from '../../../src/db/prisma.ts';

export class CrashRecoveryManager {
  private recoveryIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(recoveryIntervalMs = 15000) {
    this.recoveryIntervalMs = recoveryIntervalMs;
  }

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      await this.recoverExpiredLeases();
    }, this.recoveryIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async recoverExpiredLeases(): Promise<number> {
    try {
      // Find jobs in CLAIMED or RUNNING state where lease has expired
      const expiredJobs = await prisma.job.findMany({
        where: {
          status: { in: ['CLAIMED', 'RUNNING'] },
          leaseExpiresAt: { lt: new Date() },
        },
        include: {
          queue: {
            include: { retryPolicy: true },
          },
          retryPolicy: true,
        },
        take: 50,
      });

      if (expiredJobs.length === 0) {
        return 0;
      }

      let recoveredCount = 0;

      for (const job of expiredJobs) {
        const prevWorkerId = job.lockedByWorkerId;
        const effectiveMaxAttempts =
          job.maxAttempts ||
          job.retryPolicy?.maxAttempts ||
          job.queue.retryPolicy?.maxAttempts ||
          3;

        // Log lease expired event
        try {
          await prisma.jobLog.create({
            data: {
              jobId: job.id,
              level: 'WARN',
              message: `Job lease expired while held by worker ${prevWorkerId || 'UNKNOWN'}`,
              metadata: {
                previousWorkerId: prevWorkerId,
                attemptCount: job.attemptCount,
                leaseExpiresAt: job.leaseExpiresAt,
              },
            },
          });
        } catch (_) {}

        if (job.attemptCount < effectiveMaxAttempts) {
          // Re-queue / schedule for execution
          const updated = await prisma.job.updateMany({
            where: {
              id: job.id,
              version: job.version,
              status: { in: ['CLAIMED', 'RUNNING'] },
            },
            data: {
              status: 'SCHEDULED',
              scheduledAt: new Date(),
              lockedByWorkerId: null,
              lockedAt: null,
              leaseExpiresAt: null,
              errorMessage: `Lease expired on worker ${prevWorkerId || 'unknown'}; job recovered`,
              version: { increment: 1 },
            },
          });

          if (updated.count > 0) {
            recoveredCount++;
            try {
              await prisma.jobLog.create({
                data: {
                  jobId: job.id,
                  level: 'INFO',
                  message: `Job successfully recovered and scheduled for next attempt`,
                  metadata: {
                    attemptCount: job.attemptCount,
                    maxAttempts: effectiveMaxAttempts,
                  },
                },
              });
            } catch (_) {}
          }
        } else {
          // Max attempts reached: move to FAILED & Dead Letter Queue
          const updated = await prisma.job.updateMany({
            where: {
              id: job.id,
              version: job.version,
              status: { in: ['CLAIMED', 'RUNNING'] },
            },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              lockedByWorkerId: null,
              lockedAt: null,
              leaseExpiresAt: null,
              errorMessage: `Lease expired and max attempts (${effectiveMaxAttempts}) exhausted`,
              version: { increment: 1 },
            },
          });

          if (updated.count > 0) {
            recoveredCount++;
            await prisma.deadLetterJob.upsert({
              where: { jobId: job.id },
              create: {
                jobId: job.id,
                queueId: job.queueId,
                originalPayload: (job.payload as any) || {},
                failureReason: 'LEASE_EXPIRED_MAX_ATTEMPTS',
                errorMessage: `Lease expired on attempt ${job.attemptCount}/${effectiveMaxAttempts}`,
                finalAttemptCount: job.attemptCount,
                status: 'UNRESOLVED',
                failedAt: new Date(),
              },
              update: {
                failureReason: 'LEASE_EXPIRED_MAX_ATTEMPTS',
                errorMessage: `Lease expired on attempt ${job.attemptCount}/${effectiveMaxAttempts}`,
                finalAttemptCount: job.attemptCount,
                status: 'UNRESOLVED',
                failedAt: new Date(),
              },
            });

            try {
              await prisma.jobLog.create({
                data: {
                  jobId: job.id,
                  level: 'ERROR',
                  message: `Job lease expired and max attempts exhausted. Moved to Dead Letter Queue.`,
                  metadata: {
                    attemptCount: job.attemptCount,
                    maxAttempts: effectiveMaxAttempts,
                  },
                },
              });
            } catch (_) {}
          }
        }
      }

      return recoveredCount;
    } catch (err) {
      console.error('[CrashRecoveryManager] Error recovering expired leases:', err);
      return 0;
    }
  }
}
