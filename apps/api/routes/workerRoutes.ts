import { Router, Response, NextFunction } from 'express';
import { WorkerApiService } from '../services/workerService.ts';
import { DaemonManagerService } from '../services/daemonManager.ts';
import { authenticateJwt, AuthenticatedRequest } from '../middlewares/auth.ts';

export const workerRouter = Router();

// Apply JWT authentication
workerRouter.use(authenticateJwt);

// --- In-Process Daemon Controls for Live Interactive Demo ---
workerRouter.get('/daemon/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const status = await DaemonManagerService.getStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.post('/daemon/start', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { concurrency, pollIntervalMs } = req.body || {};
    const result = await DaemonManagerService.startPrimaryWorker({ concurrency, pollIntervalMs });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.post('/daemon/stop', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await DaemonManagerService.stopPrimaryWorker();
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.post('/daemon/step', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await DaemonManagerService.pollOnce();
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

workerRouter.post('/daemon/spawn', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await DaemonManagerService.spawnSecondaryWorker();
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// --- Standard Worker API Endpoints ---
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
