import prisma from '../../../src/db/prisma.ts';
import { DLQStatus } from '@prisma/client';

export class DLQService {
  static async listDLQ(filters: {
    queueId?: string;
    status?: DLQStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.queueId) {
      where.queueId = filters.queueId;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const [total, items] = await Promise.all([
      prisma.deadLetterJob.count({ where }),
      prisma.deadLetterJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { failedAt: 'desc' },
        include: {
          queue: {
            select: {
              id: true,
              name: true,
              projectId: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  organizationId: true,
                },
              },
            },
          },
          job: {
            select: {
              id: true,
              type: true,
              status: true,
              priority: true,
              attemptCount: true,
              maxAttempts: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getDLQById(id: string) {
    const dlq = await prisma.deadLetterJob.findFirst({
      where: {
        OR: [{ id }, { jobId: id }],
      },
      include: {
        queue: {
          select: {
            id: true,
            name: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true,
                organizationId: true,
              },
            },
          },
        },
        job: {
          include: {
            executions: {
              orderBy: { createdAt: 'asc' },
            },
            logs: {
              orderBy: { timestamp: 'asc' },
              take: 50,
            },
          },
        },
      },
    });

    if (!dlq) {
      const error: any = new Error('Dead letter job not found');
      error.statusCode = 404;
      error.code = 'DLQ_JOB_NOT_FOUND';
      throw error;
    }

    return dlq;
  }

  static async retryDLQJob(id: string) {
    const dlq = await this.getDLQById(id);

    // Atomically reset job state and mark DLQ record
    const updatedJob = await prisma.job.update({
      where: { id: dlq.jobId },
      data: {
        status: 'QUEUED',
        attemptCount: 0,
        errorMessage: null,
        failedAt: null,
        scheduledAt: new Date(),
        lockedByWorkerId: null,
        lockedAt: null,
        leaseExpiresAt: null,
        version: { increment: 1 },
      },
    });

    const updatedDLQ = await prisma.deadLetterJob.update({
      where: { id: dlq.id },
      data: {
        status: 'RETRIED',
        resolvedAt: new Date(),
      },
    });


    await prisma.jobLog.create({
      data: {
        jobId: dlq.jobId,
        level: 'INFO',
        message: 'Job replayed from Dead Letter Queue to QUEUED state',
        metadata: {
          dlqId: dlq.id,
          previousAttempts: dlq.finalAttemptCount,
        },
      },
    });

    return {
      success: true,
      message: 'Job successfully re-queued for execution',
      job: updatedJob,
      deadLetterJob: updatedDLQ,
    };
  }

  static async discardDLQJob(id: string) {
    const dlq = await this.getDLQById(id);

    const updatedDLQ = await prisma.deadLetterJob.update({
      where: { id: dlq.id },
      data: {
        status: 'DISCARDED',
        resolvedAt: new Date(),
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId: dlq.jobId,
        level: 'WARN',
        message: 'Dead Letter Job discarded manually',
        metadata: {
          dlqId: dlq.id,
        },
      },
    });

    return {
      success: true,
      message: 'Dead Letter Job discarded',
      deadLetterJob: updatedDLQ,
    };
  }
}
