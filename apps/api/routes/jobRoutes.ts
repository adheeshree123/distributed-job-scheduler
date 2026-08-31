import { Router, Response, NextFunction } from 'express';
import { JobService } from '../services/jobService.ts';
import { createJobSchema } from '../utils/validation.ts';
import {
  authenticateJwt,
  requireQueueAccess,
  AuthenticatedRequest,
} from '../middlewares/auth.ts';
import prisma from '../../../src/db/prisma.ts';
import { JobStatus, JobType } from '@prisma/client';

export const jobRouter = Router();

// Apply JWT authentication to all job routes
jobRouter.use(authenticateJwt);

jobRouter.post(
  '/queues/:queueId/jobs',
  requireQueueAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = createJobSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid job submission payload',
            details: parseResult.error.flatten(),
          },
        });
        return;
      }

      const queueId = req.params.queueId;
      const idempotencyKeyHeader = req.headers['idempotency-key'] as string | undefined;

      // Handle batch creation
      if ('jobs' in parseResult.data) {
        const result = await JobService.createBatchJobs(queueId, parseResult.data.jobs);
        res.status(201).json({
          success: true,
          data: result,
        });
        return;
      }

      // Handle single job creation
      const { job, idempotentReplay } = await JobService.createJob(
        queueId,
        parseResult.data,
        idempotencyKeyHeader
      );

      res.status(idempotentReplay ? 200 : 201).json({
        success: true,
        data: job,
        meta: {
          idempotentReplay,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

jobRouter.get(
  '/queues/:queueId/jobs',
  requireQueueAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const status = req.query.status as JobStatus | undefined;
      const type = req.query.type as JobType | undefined;
      const priority = req.query.priority !== undefined ? parseInt(req.query.priority as string, 10) : undefined;
      const scheduledAtFrom = req.query.scheduledAtFrom ? new Date(req.query.scheduledAtFrom as string) : undefined;
      const scheduledAtTo = req.query.scheduledAtTo ? new Date(req.query.scheduledAtTo as string) : undefined;
      const createdAtFrom = req.query.createdAtFrom ? new Date(req.query.createdAtFrom as string) : undefined;
      const createdAtTo = req.query.createdAtTo ? new Date(req.query.createdAtTo as string) : undefined;

      const result = await JobService.listJobs(req.params.queueId, {
        page,
        limit,
        status,
        type,
        priority,
        scheduledAtFrom,
        scheduledAtTo,
        createdAtFrom,
        createdAtTo,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
);

// --- Global Jobs & Metrics Endpoints ---

jobRouter.get(
  '/jobs/metrics/summary',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const [
        totalJobs,
        queuedJobs,
        runningJobs,
        completedJobs,
        failedJobs,
        dlqJobs,
        activeWorkers,
      ] = await Promise.all([
        prisma.job.count(),
        prisma.job.count({ where: { status: { in: [JobStatus.QUEUED, JobStatus.SCHEDULED] } } }),
        prisma.job.count({ where: { status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] } } }),
        prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
        prisma.job.count({ where: { status: JobStatus.FAILED } }),
        prisma.deadLetterJob.count({ where: { status: 'UNRESOLVED' } }),
        prisma.worker.count({ where: { status: 'ONLINE' } }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalJobs,
          queuedJobs,
          runningJobs,
          completedJobs,
          failedJobs,
          dlqJobs,
          activeWorkers,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

jobRouter.get(
  '/jobs',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? Math.min(100, parseInt(req.query.limit as string, 10)) : 25;
      const status = req.query.status as JobStatus | undefined;
      const queueId = req.query.queueId as string | undefined;
      const type = req.query.type as JobType | undefined;
      const search = req.query.search as string | undefined;

      const where: any = {};

      if (queueId) {
        where.queueId = queueId;
      }
      if (status) {
        where.status = status;
      }
      if (type) {
        where.type = type;
      }
      if (search) {
        where.OR = [
          { id: { contains: search, mode: 'insensitive' } },
          { queue: { name: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [total, jobs] = await Promise.all([
        prisma.job.count({ where }),
        prisma.job.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            queue: {
              select: {
                id: true,
                name: true,
                priority: true,
                concurrencyLimit: true,
                isPaused: true,
                project: {
                  select: {
                    id: true,
                    name: true,
                    organization: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
            retryPolicy: true,
            lockedByWorker: {
              select: {
                id: true,
                workerId: true,
                hostname: true,
                status: true,
              },
            },
            deadLetterJob: {
              select: {
                id: true,
                status: true,
                failedAt: true,
                failureReason: true,
                errorMessage: true,
              },
            },
            _count: {
              select: {
                executions: true,
                logs: true,
              },
            },
          },
        }),
      ]);

      res.status(200).json({
        success: true,
        data: jobs,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

jobRouter.post(
  '/jobs/:id/retry',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const jobId = req.params.id;
      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        res.status(404).json({
          success: false,
          error: { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        });
        return;
      }

      const updated = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.QUEUED,
          scheduledAt: new Date(),
          lockedAt: null,
          lockedByWorkerId: null,
          leaseExpiresAt: null,
          errorMessage: null,
        },
      });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Job re-queued for execution',
      });
    } catch (error) {
      next(error);
    }
  }
);

jobRouter.get(
  '/jobs/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const jobId = req.params.id;
      const job = await JobService.getJobById(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found or access denied',
          },
        });
        return;
      }

      // Check tenant membership: ensure caller belongs to the organization
      const orgId = job.queue.project.organization.id;
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: req.user!.id,
          },
        },
      });

      if (!membership) {
        // Return 404 for tenant isolation
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found or access denied',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }
);

jobRouter.get(
  '/jobs/:id/executions',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const jobId = req.params.id;
      const job = await JobService.getJobById(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found or access denied',
          },
        });
        return;
      }

      // Check tenant membership
      const orgId = job.queue.project.organization.id;
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: req.user!.id,
          },
        },
      });

      if (!membership) {
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found or access denied',
          },
        });
        return;
      }

      const executions = await prisma.jobExecution.findMany({
        where: { jobId },
        orderBy: { attemptNumber: 'asc' },
        include: {
          worker: {
            select: {
              id: true,
              workerId: true,
              hostname: true,
            },
          },
          logs: {
            orderBy: { timestamp: 'asc' },
          },
        },
      });

      res.status(200).json({
        success: true,
        data: executions,
      });
    } catch (error) {
      next(error);
    }
  }
);

jobRouter.get(
  '/jobs/:id/logs',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const jobId = req.params.id;
      const job = await JobService.getJobById(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found or access denied',
          },
        });
        return;
      }

      // Check tenant membership
      const orgId = job.queue.project.organization.id;
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: req.user!.id,
          },
        },
      });

      if (!membership) {
        res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found or access denied',
          },
        });
        return;
      }

      const logs = await prisma.jobLog.findMany({
        where: { jobId },
        orderBy: { timestamp: 'asc' },
      });

      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  }
);

