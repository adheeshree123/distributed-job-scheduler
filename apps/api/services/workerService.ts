import prisma from '../../../src/db/prisma.ts';

export class WorkerApiService {
  static async listWorkers(projectId?: string) {
    const where: any = {};
    if (projectId) {
      where.projectId = projectId;
    }

    const workers = await prisma.worker.findMany({
      where,
      orderBy: { lastHeartbeatAt: 'desc' },
      include: {
        _count: {
          select: {
            claimedJobs: true,
            executions: true,
            heartbeats: true,
          },
        },
      },
    });

    const now = Date.now();
    return workers.map((w) => {
      const heartbeatAgeMs = now - new Date(w.lastHeartbeatAt).getTime();
      const isStale = heartbeatAgeMs > 30000 && w.status === 'ONLINE';

      return {
        id: w.id,
        workerId: w.workerId,
        hostname: w.hostname,
        processId: w.processId,
        status: isStale ? 'STALE' : w.status,
        rawStatus: w.status,
        concurrency: w.concurrency,
        activeJobsCount: w.activeJobsCount,
        lastHeartbeatAt: w.lastHeartbeatAt,
        heartbeatAgeMs,
        startedAt: w.startedAt,
        stoppedAt: w.stoppedAt,
        metadata: w.metadata,
        counts: w._count,
      };
    });
  }

  static async getWorkerById(workerId: string) {
    const worker = await prisma.worker.findFirst({
      where: {
        OR: [{ id: workerId }, { workerId }],
      },
      include: {
        claimedJobs: {
          where: { status: { in: ['CLAIMED', 'RUNNING'] } },
          select: {
            id: true,
            queueId: true,
            type: true,
            status: true,
            attemptCount: true,
            lockedAt: true,
            leaseExpiresAt: true,
          },
        },
        _count: {
          select: {
            executions: true,
            heartbeats: true,
          },
        },
      },
    });

    if (!worker) {
      const error: any = new Error('Worker not found');
      error.statusCode = 404;
      error.code = 'WORKER_NOT_FOUND';
      throw error;
    }

    return worker;
  }

  static async getWorkerHeartbeats(workerId: string, limit = 50) {
    const worker = await this.getWorkerById(workerId);

    const heartbeats = await prisma.workerHeartbeat.findMany({
      where: { workerId: worker.id },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 100),
    });

    return {
      workerId: worker.id,
      workerName: worker.workerId,
      total: heartbeats.length,
      heartbeats,
    };
  }
}
