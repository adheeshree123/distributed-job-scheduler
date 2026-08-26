import prisma from '../../../src/db/prisma.ts';
import { ClaimedJobContext } from '../types.ts';

export interface RawClaimedJob {
  id: string;
  queueId: string;
  type: string;
  status: string;
  priority: number;
  payload: any;
  attemptCount: number;
  maxAttempts: number;
  retryPolicyId: string | null;
  lockedByWorkerId: string | null;
  lockedAt: Date | null;
  leaseExpiresAt: Date | null;
  version: number;
}

export class ClaimService {
  /**
   * Atomically claims up to `limit` executable jobs for the given worker.
   * Uses PostgreSQL row-level locks (SELECT ... FOR UPDATE SKIP LOCKED) inside an atomic CTE.
   *
   * Guarantees:
   * 1. Only QUEUED jobs with scheduledAt <= NOW() are eligible.
   * 2. Queues with isPaused = true are excluded.
   * 3. Queue concurrency limits are strictly enforced at the database level by comparing
   *    active (CLAIMED + RUNNING) jobs against Queue.concurrencyLimit.
   * 4. Competing workers never lock the same row (SKIP LOCKED avoids waiting/deadlocks).
   * 5. Atomically increments attemptCount and version, and sets lockedByWorkerId + leaseExpiresAt.
   */
  public static async claimJobs(
    workerDbId: string,
    limit: number,
    leaseDurationSeconds: number,
    queueIds?: string[]
  ): Promise<ClaimedJobContext[]> {
    if (limit <= 0) {
      return [];
    }

    const hasQueueFilter = Array.isArray(queueIds) && queueIds.length > 0;
    const queueCondition = hasQueueFilter ? 'AND j."queueId" = ANY($4::text[])' : '';

    const query = `
      WITH queue_active AS (
        SELECT "queueId", COUNT(*)::int AS active_count
        FROM "Job"
        WHERE "status" IN ('CLAIMED', 'RUNNING')
        GROUP BY "queueId"
      ),
      ranked_jobs AS (
        SELECT 
          j.id,
          j."queueId",
          ROW_NUMBER() OVER (PARTITION BY j."queueId" ORDER BY j.priority DESC, j."createdAt" ASC) as queue_rank,
          q."concurrencyLimit",
          COALESCE(qa.active_count, 0) AS active_count
        FROM "Job" j
        JOIN "Queue" q ON j."queueId" = q.id
        LEFT JOIN queue_active qa ON qa."queueId" = q.id
        WHERE j."status" = 'QUEUED'
          AND j."scheduledAt" <= (NOW() + INTERVAL '1 second')
          AND q."isPaused" = false
          ${queueCondition}
      ),
      eligible_jobs AS (
        SELECT rj.id
        FROM ranked_jobs rj
        JOIN "Queue" q ON rj."queueId" = q.id
        JOIN "Job" j ON rj.id = j.id
        WHERE rj.queue_rank + rj.active_count <= rj."concurrencyLimit"
        ORDER BY q.priority DESC, j.priority DESC, j."createdAt" ASC
        LIMIT $1
        FOR UPDATE OF j SKIP LOCKED
      )
      UPDATE "Job" j
      SET "status" = 'CLAIMED',
          "lockedByWorkerId" = $2,
          "lockedAt" = NOW(),
          "leaseExpiresAt" = NOW() + ($3 || ' seconds')::INTERVAL,
          "version" = j.version + 1,
          "attemptCount" = j."attemptCount" + 1,
          "updatedAt" = NOW()
      FROM eligible_jobs ej
      WHERE j.id = ej.id
      RETURNING j.id, j."queueId", j.type, j.status, j.priority, j.payload, 
                j."attemptCount", j."maxAttempts", j."retryPolicyId", 
                j."lockedByWorkerId", j."lockedAt", j."leaseExpiresAt", j.version;
    `;

    const rawRows = hasQueueFilter
      ? await prisma.$queryRawUnsafe<RawClaimedJob[]>(
          query,
          limit,
          workerDbId,
          leaseDurationSeconds,
          queueIds
        )
      : await prisma.$queryRawUnsafe<RawClaimedJob[]>(
          query,
          limit,
          workerDbId,
          leaseDurationSeconds
        );

    if (!rawRows || rawRows.length === 0) {
      return [];
    }

    const claimedJobs: ClaimedJobContext[] = [];

    for (const row of rawRows) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});

      // Record JobLog for claim
      try {
        await prisma.jobLog.create({
          data: {
            jobId: row.id,
            level: 'INFO',
            message: `Job claimed by worker (${workerDbId})`,
            metadata: {
              workerDbId,
              attemptNumber: row.attemptCount,
              leaseExpiresAt: row.leaseExpiresAt,
              version: row.version,
            },
          },
        });
      } catch (logErr) {
        console.warn(`[ClaimService] Failed to write claim log for job ${row.id}:`, logErr);
      }

      claimedJobs.push({
        jobId: row.id,
        queueId: row.queueId,
        type: row.type,
        attemptNumber: row.attemptCount,
        maxAttempts: row.maxAttempts,
        payload,
        retryPolicyId: row.retryPolicyId,
        leaseExpiresAt: row.leaseExpiresAt ? new Date(row.leaseExpiresAt) : new Date(Date.now() + leaseDurationSeconds * 1000),
        version: row.version,
      });
    }

    return claimedJobs;
  }
}
