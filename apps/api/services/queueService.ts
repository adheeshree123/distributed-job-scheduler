import prisma from '../../../src/db/prisma.ts';
import { CreateQueueInput, UpdateQueueInput } from '../utils/validation.ts';
import { JobStatus } from '@prisma/client';

export class QueueService {
  static async createQueue(projectId: string, input: CreateQueueInput) {
    const existing = await prisma.queue.findFirst({
      where: {
        projectId,
        name: input.name.trim(),
      },
    });

    if (existing) {
      const error: any = new Error(`Queue with name "${input.name.trim()}" already exists in this project`);
      error.statusCode = 409;
      error.code = 'QUEUE_EXISTS';
      throw error;
    }

    if (input.retryPolicyId) {
      const policy = await prisma.retryPolicy.findUnique({
        where: { id: input.retryPolicyId },
      });
      if (!policy) {
        const error: any = new Error('Specified retry policy not found');
        error.statusCode = 400;
        error.code = 'RETRY_POLICY_NOT_FOUND';
        throw error;
      }
    }

    return await prisma.queue.create({
      data: {
        projectId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        priority: input.priority ?? 0,
        concurrencyLimit: input.concurrencyLimit ?? 10,
        retryPolicyId: input.retryPolicyId || null,
      },
      include: {
        retryPolicy: true,
      },
    });
  }

  static async listQueues(
    projectId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isPaused?: boolean;
    } = {}
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { projectId };
    if (options.search) {
      where.name = { contains: options.search, mode: 'insensitive' };
    }
    if (options.isPaused !== undefined) {
      where.isPaused = options.isPaused;
    }

    const [total, queues] = await Promise.all([
      prisma.queue.count({ where }),
      prisma.queue.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          retryPolicy: true,
          _count: {
            select: {
              jobs: true,
              deadLetterJobs: true,
              scheduledJobs: true,
            },
          },
        },
      }),
    ]);

    return {
      data: queues,
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getQueue(queueId: string) {
    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizationId: true,
          },
        },
        retryPolicy: true,
        _count: {
          select: {
            jobs: true,
            deadLetterJobs: true,
            scheduledJobs: true,
          },
        },
      },
    });

    return queue;
  }

  static async updateQueue(queueId: string, input: UpdateQueueInput) {
    if (input.name) {
      const queue = await prisma.queue.findUnique({ where: { id: queueId } });
      if (queue) {
        const existing = await prisma.queue.findFirst({
          where: {
            projectId: queue.projectId,
            name: input.name.trim(),
            NOT: { id: queueId },
          },
        });
        if (existing) {
          const error: any = new Error(`Queue with name "${input.name.trim()}" already exists in this project`);
          error.statusCode = 409;
          error.code = 'QUEUE_EXISTS';
          throw error;
        }
      }
    }

    if (input.retryPolicyId) {
      const policy = await prisma.retryPolicy.findUnique({
        where: { id: input.retryPolicyId },
      });
      if (!policy) {
        const error: any = new Error('Specified retry policy not found');
        error.statusCode = 400;
        error.code = 'RETRY_POLICY_NOT_FOUND';
        throw error;
      }
    }

    return await prisma.queue.update({
      where: { id: queueId },
      data: {
        ...(input.name && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.concurrencyLimit !== undefined && { concurrencyLimit: input.concurrencyLimit }),
        ...(input.retryPolicyId !== undefined && { retryPolicyId: input.retryPolicyId }),
      },
      include: {
        retryPolicy: true,
      },
    });
  }

  static async deleteQueue(queueId: string) {
    return await prisma.queue.delete({
      where: { id: queueId },
    });
  }

  static async pauseQueue(queueId: string) {
    return await prisma.queue.update({
      where: { id: queueId },
      data: { isPaused: true },
    });
  }

  static async resumeQueue(queueId: string) {
    return await prisma.queue.update({
      where: { id: queueId },
      data: { isPaused: false },
    });
  }

  static async getQueueStats(queueId: string) {
    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      select: {
        id: true,
        name: true,
        isPaused: true,
        concurrencyLimit: true,
        priority: true,
      },
    });

    if (!queue) {
      const error: any = new Error('Queue not found');
      error.statusCode = 404;
      error.code = 'QUEUE_NOT_FOUND';
      throw error;
    }

    // Group jobs by status
    const statusCounts = await prisma.job.groupBy({
      by: ['status'],
      where: { queueId },
      _count: {
        id: true,
      },
    });

    const counts: Record<string, number> = {
      QUEUED: 0,
      SCHEDULED: 0,
      CLAIMED: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
    };

    let totalJobs = 0;
    for (const sc of statusCounts) {
      counts[sc.status] = sc._count.id;
      totalJobs += sc._count.id;
    }

    const oneHourAgo = new Date(Date.now() - 3600000);
    const [deadLetterCount, recentCompletedCount, execStats, retryStats] = await Promise.all([
      prisma.deadLetterJob.count({
        where: { queueId },
      }),
      prisma.job.count({
        where: {
          queueId,
          status: 'COMPLETED',
          completedAt: { gte: oneHourAgo },
        },
      }),
      prisma.jobExecution.aggregate({
        where: {
          job: { queueId },
          status: 'COMPLETED',
          durationMs: { not: null },
        },
        _avg: {
          durationMs: true,
        },
      }),
      prisma.job.aggregate({
        where: {
          queueId,
          attemptCount: { gt: 1 },
        },
        _sum: {
          attemptCount: true,
        },
      }),
    ]);

    const averageDurationMs = execStats._avg.durationMs
      ? Math.round(execStats._avg.durationMs)
      : 0;
    const retryCount = (retryStats._sum.attemptCount || 0);

    return {
      queueId: queue.id,
      queueName: queue.name,
      isPaused: queue.isPaused,
      concurrencyLimit: queue.concurrencyLimit,
      priority: queue.priority,
      totalJobs,
      deadLetterCount,
      dlqCount: deadLetterCount,
      queued: counts.QUEUED,
      scheduled: counts.SCHEDULED,
      claimed: counts.CLAIMED,
      running: counts.RUNNING,
      completed: counts.COMPLETED,
      failed: counts.FAILED,
      cancelled: counts.CANCELLED,
      statusCounts: counts,
      inFlightCount: counts.CLAIMED + counts.RUNNING,
      availableCapacity: Math.max(0, queue.concurrencyLimit - (counts.CLAIMED + counts.RUNNING)),
      throughputPerHour: recentCompletedCount,
      averageDurationMs,
      retryCount,
    };
  }
}

