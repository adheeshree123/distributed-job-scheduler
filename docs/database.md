# Database Schema & Storage Architecture

This document details the PostgreSQL schema, relational structure, indexes, and cascade policies for the Distributed Job Scheduler.

---

## 1. Core Principles

1. **PostgreSQL as Single Source of Truth**: All job states, queue allocations, leases, and retry counters reside in PostgreSQL with full ACID transactional semantics.
2. **Normalized Relational Model**: Separation between job definition (`Job`), execution attempts (`JobExecution`), logs (`JobLog`), policies (`RetryPolicy`), and dead-letter records (`DeadLetterJob`).
3. **UUID Primary Keys**: Uniform `@default(uuid())` primary keys across all 13 models to prevent ID enumeration and support distributed generation.
4. **JSONB for Variable Payloads**: Payload, result data, worker telemetry, and log metadata use native PostgreSQL `JSONB` for schema flexibility and efficient binary storage.

---

## 2. Entity Dictionary

### 1. User
- **Fields**: `id` (UUID PK), `email` (Unique), `name`, `passwordHash`, `createdAt`, `updatedAt`
- **Purpose**: System accounts for authentication and role-based access. Plaintext passwords are never stored.

### 2. Organization
- **Fields**: `id` (UUID PK), `name`, `slug` (Unique), `createdAt`, `updatedAt`
- **Purpose**: Multi-tenant boundary grouping projects, users, and infrastructure.

### 3. OrganizationMember
- **Fields**: `id` (UUID PK), `organizationId` (FK), `userId` (FK), `role` (`OWNER`, `ADMIN`, `MEMBER`), `createdAt`, `updatedAt`
- **Constraints**: `@@unique([organizationId, userId])`
- **Cascade**: Deletion of `Organization` or `User` cascades to remove membership.

### 4. Project
- **Fields**: `id` (UUID PK), `organizationId` (FK), `name`, `slug`, `description`, `createdAt`, `updatedAt`
- **Constraints**: `@@unique([organizationId, name])`, `@@unique([organizationId, slug])`
- **Cascade**: Deleting an Organization cascades to delete all child projects.

### 5. RetryPolicy
- **Fields**: `id` (UUID PK), `name` (Unique), `strategy` (`FIXED`, `LINEAR`, `EXPONENTIAL`), `baseDelayMs`, `maxDelayMs`, `maxAttempts`, `backoffFactor`, `createdAt`, `updatedAt`
- **Purpose**: Reusable retry configurations assignable to queues or specific jobs.

### 6. Queue
- **Fields**: `id` (UUID PK), `projectId` (FK), `retryPolicyId` (FK nullable), `name`, `description`, `priority`, `concurrencyLimit`, `isPaused`, `createdAt`, `updatedAt`
- **Constraints**: `@@unique([projectId, name])`
- **Cascade**: Project deletion cascades to delete queues. RetryPolicy deletion sets FK to `NULL`.

### 7. Job (Central Entity)
- **Fields**:
  - `id` (UUID PK)
  - `queueId` (FK)
  - `retryPolicyId` (FK nullable)
  - `idempotencyKey` (nullable string)
  - `type` (`IMMEDIATE`, `DELAYED`, `SCHEDULED`, `CRON`, `BATCH`)
  - `status` (`QUEUED`, `SCHEDULED`, `CLAIMED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`)
  - `priority` (integer, higher executes first)
  - `payload` (JSONB)
  - `result` (JSONB nullable)
  - `errorMessage` (nullable string)
  - `attemptCount` (integer, default 0)
  - `maxAttempts` (integer, default 3)
  - `scheduledAt` (timestamp)
  - `lockedAt` (timestamp nullable)
  - `leaseExpiresAt` (timestamp nullable)
  - `lockedByWorkerId` (FK nullable)
  - `version` (integer for optimistic concurrency)
  - `batchId` (nullable string)
  - `parentJobId` (FK self-relation nullable)
  - `startedAt`, `completedAt`, `failedAt`, `createdAt`, `updatedAt`
- **Constraints**: `@@unique([queueId, idempotencyKey])`

### 8. JobExecution
- **Fields**: `id` (UUID PK), `jobId` (FK), `workerId` (FK nullable), `attemptNumber` (int), `status` (`RUNNING`, `COMPLETED`, `FAILED`), `startedAt`, `completedAt`, `durationMs`, `errorMessage`, `result` (JSONB), `workerMetadata` (JSONB), `createdAt`
- **Purpose**: Append-only immutable log for each attempt of a job.
- **Cascade**: `Job` deletion cascades. `Worker` deletion sets FK to `NULL` (preserving audit history).

### 9. JobLog
- **Fields**: `id` (UUID PK), `jobId` (FK), `executionId` (FK nullable), `level` (`INFO`, `WARN`, `ERROR`, `DEBUG`), `message`, `metadata` (JSONB), `timestamp`
- **Purpose**: Structured log messages emitted during execution.

### 10. Worker
- **Fields**: `id` (UUID PK), `workerId` (Unique string identity), `projectId` (FK nullable), `hostname`, `processId`, `status` (`ONLINE`, `DRAINING`, `OFFLINE`), `concurrency`, `activeJobsCount`, `lastHeartbeatAt`, `startedAt`, `stoppedAt`, `metadata` (JSONB), `createdAt`, `updatedAt`
- **Purpose**: Registry of active and historic worker daemons.

### 11. WorkerHeartbeat
- **Fields**: `id` (UUID PK), `workerId` (FK), `timestamp`, `activeJobsCount`, `cpuUsagePct`, `memoryUsageMb`, `systemLoad` (JSONB)
- **Purpose**: Time-series health telemetry emitted by active worker nodes.

### 12. ScheduledJob
- **Fields**: `id` (UUID PK), `projectId` (FK), `queueId` (FK), `name`, `jobType` (`CRON`), `payload` (JSONB), `cronExpression`, `timezone`, `priority`, `isEnabled`, `lastRunAt`, `nextRunAt`, `createdAt`, `updatedAt`
- **Purpose**: Cron definitions for recurring job scheduling.

### 13. DeadLetterJob
- **Fields**: `id` (UUID PK), `jobId` (FK unique), `queueId` (FK), `originalPayload` (JSONB), `failureReason`, `errorMessage`, `finalAttemptCount`, `status` (`UNRESOLVED`, `RETRIED`, `DISCARDED`), `failedAt`, `resolvedAt`, `createdAt`
- **Purpose**: Quarantine storage for jobs that exhausted all retry attempts or failed fatally.

---

## 3. High-Performance Indexing Strategy

| Index | Target Table | Columns | Justification |
| :--- | :--- | :--- | :--- |
| **Worker Claim Index** | `Job` | `(queueId, status, scheduledAt, priority, createdAt)` | Powers `SELECT ... FOR UPDATE SKIP LOCKED` by locating runnable jobs (`status = 'QUEUED' AND scheduledAt <= NOW()`) ordered by priority DESC, createdAt ASC without memory sorting. |
| **Lease Crash Recovery Index** | `Job` | `(status, leaseExpiresAt)` | Enables sub-millisecond detection of orphaned jobs whose worker died (`status IN ('CLAIMED', 'RUNNING') AND leaseExpiresAt < NOW()`). |
| **Idempotency Index** | `Job` | `(queueId, idempotencyKey)` | Enforces atomic deduplication per queue. |
| **Cron Trigger Index** | `ScheduledJob` | `(isEnabled, nextRunAt)` | Fast polling index for the scheduler cron daemon. |
| **Telemetry Index** | `WorkerHeartbeat` | `(workerId, timestamp)` | Optimizes worker health charts and time-series aggregation. |
| **Job Logs Index** | `JobLog` | `(jobId, timestamp)` | Speeds up execution log streaming in the console UI. |
| **Execution History Index** | `JobExecution`| `(jobId, createdAt)` | Fast retrieval of attempt histories per job. |

---

## 4. Cascading & Historical Data Integrity Decisions

1. **Structural Deletion (Cascade)**:
   - `Organization` → `OrganizationMember`, `Project`
   - `Project` → `Queue`, `ScheduledJob`
   - `Queue` → `Job`, `ScheduledJob`, `DeadLetterJob`
   - `Job` → `JobExecution`, `JobLog`, `DeadLetterJob`
2. **Audit Preservation (`ON DELETE SET NULL`)**:
   - `Worker` deletion does **not** delete `JobExecution` or `Job`. Instead, `workerId` and `lockedByWorkerId` are set to `NULL` to maintain complete execution history.
   - `RetryPolicy` deletion sets `Queue.retryPolicyId` to `NULL` (queues fall back to system defaults).
