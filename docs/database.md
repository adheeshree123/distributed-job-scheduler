# Database Schema & Indexing Design

## 1. Entity Relationship Hierarchy

```
User (id, email, passwordHash)
  └── OrganizationMember (role: OWNER | ADMIN | MEMBER)
        └── Organization (name, slug)
              └── Project (name, slug)
                    ├── Queue (priority, concurrencyLimit, isPaused)
                    │     ├── Job (type, status, priority, payload, leaseExpiresAt, version)
                    │     │     ├── JobExecution (workerId, attemptNumber, durationMs, error)
                    │     │     └── JobLog (level, message, timestamp)
                    │     ├── ScheduledJob (cronExpression, nextRunAt, isEnabled)
                    │     └── DeadLetterJob (failureReason, attemptCount, status)
                    └── Worker (hostname, processId, status, concurrency)
                          └── WorkerHeartbeat (activeJobsCount, cpuUsage, memoryUsage)
```

## 2. High-Performance Indexing Strategy

1. **Job Claiming Index**:
   ```sql
   CREATE INDEX idx_jobs_claim ON "Job" ("queueId", "status", "scheduledAt", "priority" DESC, "createdAt" ASC);
   ```
   *Purpose*: Accelerates `SELECT ... FOR UPDATE SKIP LOCKED` queries matching executable jobs without sorting overhead.

2. **Lease Crash Recovery Index**:
   ```sql
   CREATE INDEX idx_jobs_lease_recovery ON "Job" ("status", "leaseExpiresAt");
   ```
   *Purpose*: Instantly identifies stale jobs whose workers crashed or missed heartbeats.

3. **Idempotency Composite Constraint**:
   ```sql
   CREATE UNIQUE INDEX idx_jobs_idempotency ON "Job" ("queueId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
   ```
   *Purpose*: Enforces hard database-level deduplication during concurrent ingestion.

4. **Scheduled Cron Trigger Index**:
   ```sql
   CREATE INDEX idx_scheduled_jobs_trigger ON "ScheduledJob" ("isEnabled", "nextRunAt");
   ```
