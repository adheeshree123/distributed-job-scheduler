import { Router, Response, NextFunction } from 'express';
import { DLQService } from '../services/dlqService.ts';
import { authenticateJwt, AuthenticatedRequest } from '../middlewares/auth.ts';
import { DLQStatus } from '@prisma/client';

export const dlqRouter = Router();

// Apply JWT authentication
dlqRouter.use(authenticateJwt);

dlqRouter.get('/dlq', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const queueId = req.query.queueId as string | undefined;
    const status = req.query.status as DLQStatus | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await DLQService.listDLQ({ queueId, status, page, limit });

    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

dlqRouter.get('/dlq/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const item = await DLQService.getDLQById(req.params.id);

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

dlqRouter.post('/dlq/:id/retry', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await DLQService.retryDLQJob(req.params.id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

dlqRouter.post('/dlq/:id/discard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await DLQService.discardDLQJob(req.params.id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});
