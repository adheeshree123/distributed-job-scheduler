import { Router, Response, NextFunction } from 'express';
import { QueueService } from '../services/queueService.ts';
import prisma from '../../../src/db/prisma.ts';
import {
  createQueueSchema,
  updateQueueSchema,
} from '../utils/validation.ts';
import {
  authenticateJwt,
  requireProjectAccess,
  requireQueueAccess,
  requireRole,
  AuthenticatedRequest,
} from '../middlewares/auth.ts';

export const queueRouter = Router();

// Apply JWT authentication to all queue routes
queueRouter.use(authenticateJwt);

// --- Global Accessible Queues & Retry Policies for Frontend Dashboard ---
queueRouter.get('/queues', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const queues = await prisma.queue.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: {
              select: { id: true, name: true },
            },
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

    // Calculate live job stats for each queue
    const queuesWithStats = await Promise.all(
      queues.map(async (q) => {
        const [queued, running, completed, failed] = await Promise.all([
          prisma.job.count({
            where: { queueId: q.id, status: { in: ['QUEUED', 'SCHEDULED'] } },
          }),
          prisma.job.count({
            where: { queueId: q.id, status: { in: ['CLAIMED', 'RUNNING'] } },
          }),
          prisma.job.count({
            where: { queueId: q.id, status: 'COMPLETED' },
          }),
          prisma.job.count({
            where: { queueId: q.id, status: 'FAILED' },
          }),
        ]);

        return {
          ...q,
          stats: {
            queued,
            running,
            completed,
            failed,
            dlq: q._count.deadLetterJobs,
            total: q._count.jobs,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      data: queuesWithStats,
    });
  } catch (error) {
    next(error);
  }
});

queueRouter.get('/retry-policies', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const policies = await prisma.retryPolicy.findMany({
      orderBy: { name: 'asc' },
    });
    res.status(200).json({
      success: true,
      data: policies,
    });
  } catch (error) {
    next(error);
  }
});

// --- Project Scoped Queue Endpoints ---

queueRouter.post(
  '/projects/:projectId/queues',
  requireProjectAccess,
  requireRole(['OWNER', 'ADMIN']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = createQueueSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid queue input',
            details: parseResult.error.flatten(),
          },
        });
        return;
      }

      const queue = await QueueService.createQueue(req.params.projectId, parseResult.data);
      res.status(201).json({
        success: true,
        data: queue,
      });
    } catch (error) {
      next(error);
    }
  }
);

queueRouter.get(
  '/projects/:projectId/queues',
  requireProjectAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const isPaused = req.query.isPaused !== undefined ? req.query.isPaused === 'true' : undefined;

      const result = await QueueService.listQueues(req.params.projectId, {
        page,
        limit,
        search,
        isPaused,
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

// --- Direct Queue ID Endpoints ---

queueRouter.get(
  '/queues/:id',
  requireQueueAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const queue = await QueueService.getQueue(req.params.id);
      res.status(200).json({
        success: true,
        data: queue,
      });
    } catch (error) {
      next(error);
    }
  }
);

queueRouter.patch(
  '/queues/:id',
  requireQueueAccess,
  requireRole(['OWNER', 'ADMIN']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parseResult = updateQueueSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update input',
            details: parseResult.error.flatten(),
          },
        });
        return;
      }

      const updated = await QueueService.updateQueue(req.params.id, parseResult.data);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

queueRouter.delete(
  '/queues/:id',
  requireQueueAccess,
  requireRole(['OWNER']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await QueueService.deleteQueue(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Queue deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

queueRouter.post(
  '/queues/:id/pause',
  requireQueueAccess,
  requireRole(['OWNER', 'ADMIN']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const queue = await QueueService.pauseQueue(req.params.id);
      res.status(200).json({
        success: true,
        data: queue,
      });
    } catch (error) {
      next(error);
    }
  }
);

queueRouter.post(
  '/queues/:id/resume',
  requireQueueAccess,
  requireRole(['OWNER', 'ADMIN']),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const queue = await QueueService.resumeQueue(req.params.id);
      res.status(200).json({
        success: true,
        data: queue,
      });
    } catch (error) {
      next(error);
    }
  }
);

queueRouter.get(
  '/queues/:id/stats',
  requireQueueAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await QueueService.getQueueStats(req.params.id);
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);
