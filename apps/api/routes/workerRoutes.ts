import { Router, Response, NextFunction } from 'express';
import { WorkerApiService } from '../services/workerService.ts';
import { authenticateJwt, AuthenticatedRequest } from '../middlewares/auth.ts';

export const workerRouter = Router();

// Apply JWT authentication
workerRouter.use(authenticateJwt);

workerRouter.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const workers = await WorkerApiService.listWorkers(projectId);

    res.status(200).json({
      success: true,
      data: workers,
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const worker = await WorkerApiService.getWorkerById(req.params.id);

    res.status(200).json({
      success: true,
      data: worker,
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.get('/:id/heartbeats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const data = await WorkerApiService.getWorkerHeartbeats(req.params.id, limit);

    res.status(200).json({
      success: true,
      data: data.heartbeats,
      meta: {
        workerId: data.workerId,
        workerName: data.workerName,
        total: data.total,
      },
    });
  } catch (error) {
    next(error);
  }
});
