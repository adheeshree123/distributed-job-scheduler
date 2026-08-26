import parser from 'cron-parser';
import prisma from '../../../src/db/prisma.ts';

export class CronDispatcher {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
  }

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      await this.dispatchReadyJobs();
      await this.dispatchCronJobs();
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Promotes SCHEDULED jobs whose scheduledAt timestamp has arrived to QUEUED.
   */
  public async dispatchReadyJobs(): Promise<number> {
    try {
      const result = await prisma.job.updateMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: new Date() },
        },
        data: {
          status: 'QUEUED',
          updatedAt: new Date(),
        },
      });

      return result.count;
    } catch (err) {
      console.error('[CronDispatcher] Error dispatching scheduled jobs:', err);
      return 0;
    }
  }

  /**
   * Checks for active recurring cron jobs (ScheduledJob) whose nextRunAt <= NOW()
   * and creates queued jobs for them while advancing nextRunAt.
   */
  public async dispatchCronJobs(): Promise<number> {
    try {
      const dueSchedules = await prisma.scheduledJob.findMany({
        where: {
          isEnabled: true,
          nextRunAt: { lte: new Date() },
        },
        take: 20,
      });

      let dispatchedCount = 0;

      for (const schedule of dueSchedules) {
        try {
          // Parse next execution date from cron expression
          let nextRunAt: Date;
          try {
            const interval = (parser as any).parseExpression(schedule.cronExpression, {
              currentDate: schedule.nextRunAt,
              tz: schedule.timezone || 'UTC',
            });
            nextRunAt = interval.next().toDate();
          } catch (cronErr) {
            // Fallback: +1 hour
            nextRunAt = new Date(Date.now() + 3600000);
          }

          // Atomically lock and advance ScheduledJob to prevent double execution
          const updatedSchedule = await prisma.scheduledJob.updateMany({
            where: {
              id: schedule.id,
              isEnabled: true,
              nextRunAt: schedule.nextRunAt,
            },
            data: {
              lastRunAt: schedule.nextRunAt,
              nextRunAt,
            },
          });

          if (updatedSchedule.count > 0) {
            // Create queued job for this cron trigger
            const job = await prisma.job.create({
              data: {
                queueId: schedule.queueId,
                type: 'CRON',
                status: 'QUEUED',
                priority: schedule.priority,
                payload: (schedule.payload as any) || {},
                scheduledAt: new Date(),
              },
            });

            await prisma.jobLog.create({
              data: {
                jobId: job.id,
                level: 'INFO',
                message: `Recurring cron job spawned from schedule "${schedule.name}"`,
                metadata: {
                  scheduledJobId: schedule.id,
                  cronExpression: schedule.cronExpression,
                  nextRunAt: nextRunAt.toISOString(),
                },
              },
            });

            dispatchedCount++;
          }
        } catch (scheduleErr) {
          console.error(
            `[CronDispatcher] Error processing scheduled job ${schedule.id}:`,
            scheduleErr
          );
        }
      }

      return dispatchedCount;
    } catch (err) {
      console.error('[CronDispatcher] Error querying due cron schedules:', err);
      return 0;
    }
  }
}
