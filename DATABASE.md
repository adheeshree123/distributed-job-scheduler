# Database Schema & Storage Architecture

See the complete architectural specification in [`docs/database.md`](./docs/database.md) and the Prisma schema at [`prisma/schema.prisma`](./prisma/schema.prisma).

## Summary
- **13 Relational Models**: `User`, `Organization`, `OrganizationMember`, `Project`, `Queue`, `RetryPolicy`, `Job`, `JobExecution`, `JobLog`, `Worker`, `WorkerHeartbeat`, `ScheduledJob`, `DeadLetterJob`.
- **Key Indexes**:
  - `Job(queueId, status, scheduledAt, priority, createdAt)` for atomic row claiming.
  - `Job(status, leaseExpiresAt)` for crash recovery.
  - `Job(queueId, idempotencyKey)` for duplicate suppression.
- **Cascade Strategy**:
  - Structural entities cascade upon parent deletion.
  - Historical execution records (`JobExecution`) preserve data using `ON DELETE SET NULL` on worker references.
