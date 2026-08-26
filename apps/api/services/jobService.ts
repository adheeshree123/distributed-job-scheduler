import { Prisma, JobStatus, JobType } from '@prisma/client';
import { CronExpressionParser } from 'cron-parser';
import crypto from 'crypto';
import prisma from '../../../src/db/prisma.ts';
import { SingleJobItemInput } from '../utils/validation.ts';

export class JobService {
  static async createJob(
    queueId: string,
    input: SingleJobItemInput,
    idempotencyKeyHeader?: string
  ) {
    const idempotencyKey = input.idempotencyKey || idempotencyKeyHeader || null;

    // Check if idempotent job already exists
    if (idempotencyKey) {
      const existing = await prisma.job.findUnique({
        where: {
          queueId_idempotencyKey: {
            queueId,
            idempotencyKey,
          },
        },
        include: {
          retryPolicy: true,
        },
      });

      if (existing) {
        return { job: existing, idempotentReplay: true };
      }
    }

    // Determine Job Type & Scheduled Date
    let jobType: JobType = input.type || JobType.IMMEDIATE;
    let scheduledAt = new Date();
    let initialStatus: JobStatus = JobStatus.QUEUED;

    if (input.cronExpression) {
      jobType = JobType.CRON;
      try {
        const interval = CronExpressionParser.parse(input.cronExpression, {
          currentDate: new Date(),
          tz: input.timezone || 'UTC',
        });
        scheduledAt = interval.next().toDate();
        initialStatus = JobStatus.SCHEDULED;
      } catch (err: any) {
        const error: any = new Error(`Invalid cron expression "${input.cronExpression}": ${err.message}`);
        error.statusCode = 400;
        error.code = 'INVALID_CRON_EXPRESSION';
        throw error;
      }
    } else if (input.delayMs !== undefined && input.delayMs > 0) {
      jobType = JobType.DELAYED;
      scheduledAt = new Date(Date.now() + input.delayMs);
      initialStatus = JobStatus.SCHEDULED;
    } else if (input.scheduledAt) {
      const targetDate = new Date(input.scheduledAt);
      if (isNaN(targetDate.getTime())) {
        const error: any = new Error('Invalid scheduledAt date format');
        error.statusCode = 400;
        error.code = 'INVALID_DATE';
        throw error;
      }
      scheduledAt = targetDate;
      if (scheduledAt.getTime() > Date.now()) {
        jobType = jobType === JobType.IMMEDIATE ? JobType.SCHEDULED : jobType;
        initialStatus = JobStatus.SCHEDULED;
      }
    }

    // If cron expression is provided, also register or sync a ScheduledJob configuration
    if (input.cronExpression) {
      const queue = await prisma.queue.findUnique({
        where: { id: queueId },
        select: { projectId: true },
      });

      if (queue) {
        await prisma.scheduledJob.create({
          data: {
            projectId: queue.projectId,
            queueId,
            name: `Cron Job ${input.cronExpression}`,
            cronExpression: input.cronExpression,
            timezone: input.timezone || 'UTC',
            payload: (input.payload || {}) as Prisma.InputJsonValue,
            priority: input.priority ?? 0,
            nextRunAt: scheduledAt,
            isEnabled: true,
          },
        });
      }
    }

    try {
      const job = await prisma.job.create({
        data: {
          queueId,
          type: jobType,
          status: initialStatus,
          priority: input.priority ?? 0,
          payload: (input.payload || {}) as Prisma.InputJsonValue,
          idempotencyKey,
          scheduledAt,
          maxAttempts: input.maxAttempts ?? 3,
          retryPolicyId: input.retryPolicyId || null,
        },
        include: {
          retryPolicy: true,
        },
      });

      return { job, idempotentReplay: false };
    } catch (error: any) {
      // Catch unique constraint violation in case of concurrent duplicate submission
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        if (idempotencyKey) {
          const existing = await prisma.job.findUnique({
            where: {
              queueId_idempotencyKey: {
                queueId,
                idempotencyKey,
              },
            },
            include: { retryPolicy: true },
          });
          if (existing) {
            return { job: existing, idempotentReplay: true };
          }
        }
      }
      throw error;
    }
  }

  static async createBatchJobs(
    queueId: string,
    jobsList: SingleJobItemInput[]
  ) {
    if (!jobsList || jobsList.length === 0) {
      const error: any = new Error('Batch list must contain at least 1 job');
      error.statusCode = 400;
      error.code = 'INVALID_BATCH';
      throw error;
    }

    const batchId = crypto.randomUUID();

    // Validate all items before attempting transaction
    for (let i = 0; i < jobsList.length; i++) {
      const item = jobsList[i];
      if (item.cronExpression) {
        try {
          CronExpressionParser.parse(item.cronExpression, {
            currentDate: new Date(),
            tz: item.timezone || 'UTC',
          });
        } catch (err: any) {
          const error: any = new Error(`Item [${i}] has invalid cron expression "${item.cronExpression}": ${err.message}`);
          error.statusCode = 400;
          error.code = 'INVALID_CRON_EXPRESSION';
          throw error;
        }
      }
    }

    // Execute atomic batch creation in a single Prisma transaction
    return await prisma.$transaction(async (tx) => {
      const createdJobs = [];

      for (let i = 0; i < jobsList.length; i++) {
        const item = jobsList[i];
        let jobType: JobType = item.type || JobType.IMMEDIATE;
        let scheduledAt = new Date();
        let initialStatus: JobStatus = JobStatus.QUEUED;

        if (item.delayMs !== undefined && item.delayMs > 0) {
          jobType = JobType.DELAYED;
          scheduledAt = new Date(Date.now() + item.delayMs);
          initialStatus = JobStatus.SCHEDULED;
        } else if (item.scheduledAt) {
          const targetDate = new Date(item.scheduledAt);
          if (isNaN(targetDate.getTime())) {
            const error: any = new Error(`Item [${i}] has invalid scheduledAt date`);
            error.statusCode = 400;
            error.code = 'INVALID_DATE';
            throw error;
          }
          scheduledAt = targetDate;
          if (scheduledAt.getTime() > Date.now()) {
            jobType = jobType === JobType.IMMEDIATE ? JobType.SCHEDULED : jobType;
            initialStatus = JobStatus.SCHEDULED;
          }
        }

        const job = await tx.job.create({
          data: {
            queueId,
            batchId,
            type: jobType,
            status: initialStatus,
            priority: item.priority ?? 0,
            payload: (item.payload || {}) as Prisma.InputJsonValue,
            idempotencyKey: item.idempotencyKey || null,
            scheduledAt,
            maxAttempts: item.maxAttempts ?? 3,
            retryPolicyId: item.retryPolicyId || null,
          },
        });

        createdJobs.push(job);
      }

      return {
        batchId,
        count: createdJobs.length,
        jobs: createdJobs,
      };
    });
  }

  static async listJobs(
    queueId: string,
    options: {
      page?: number;
      limit?: number;
      status?: JobStatus;
      type?: JobType;
      priority?: number;
      scheduledAtFrom?: Date;
      scheduledAtTo?: Date;
      createdAtFrom?: Date;
      createdAtTo?: Date;
    } = {}
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = { queueId };

    if (options.status) {
      where.status = options.status;
    }
    if (options.type) {
      where.type = options.type;
    }
    if (options.priority !== undefined) {
      where.priority = options.priority;
    }
    if (options.scheduledAtFrom || options.scheduledAtTo) {
      where.scheduledAt = {
        ...(options.scheduledAtFrom && { gte: options.scheduledAtFrom }),
        ...(options.scheduledAtTo && { lte: options.scheduledAtTo }),
      };
    }
    if (options.createdAtFrom || options.createdAtTo) {
      where.createdAt = {
        ...(options.createdAtFrom && { gte: options.createdAtFrom }),
        ...(options.createdAtTo && { lte: options.createdAtTo }),
      };
    }

    const [total, jobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          retryPolicy: true,
          _count: {
            select: {
              executions: true,
              logs: true,
            },
          },
        },
      }),
    ]);

    return {
      data: jobs,
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getJobById(jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        queue: {
          include: {
            project: {
              include: {
                organization: true,
              },
            },
          },
        },
        retryPolicy: true,
        executions: {
          orderBy: { attemptNumber: 'desc' },
          include: {
            worker: {
              select: {
                id: true,
                workerId: true,
                hostname: true,
              },
            },
          },
        },
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
        deadLetterJob: true,
      },
    });

    return job;
  }
}
