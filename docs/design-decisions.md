# System Design Decisions & Architectural Rationale

This document details the architectural decisions, trade-offs, and invariants governing the Distributed Job Scheduler.

---

## 1. Why PostgreSQL as the Single Source of Truth
- **Decision**: All job states, queue configurations, worker claims, retry policies, and execution records live in PostgreSQL rather than an auxiliary in-memory store (e.g., Redis).
- **Rationale**:
  - **Eliminates Distributed Dual-State Desynchronization**: Having two state systems (e.g., Redis for locks + PostgreSQL for persistence) creates split-brain scenarios when one crashes or network partitions occur.
  - **ACID Transactions**: Job transitions (`CLAIMED` -> `RUNNING` -> `COMPLETED`/`FAILED`) and execution log appends happen in atomic database transactions.
  - **Rich Indexing & Query Flexibility**: Relational indexes support priority ordering, scheduled lookaheads, status aggregation, and historical auditing in one engine.

---

## 2. Why Workers Will Use `SELECT ... FOR UPDATE SKIP LOCKED`
- **Decision**: Worker polling claims candidate jobs via PostgreSQL's native row-level lock clause with `SKIP LOCKED`.
- **Rationale**:
  - **Zero Lock Contention**: Concurrent workers attempting to claim jobs do not block each other; each worker skips rows currently locked by other workers and claims the next available candidate.
  - **No Distributed Mutex Overhead**: Avoids complex Redis Redlock algorithms or ZooKeeper/etcd distributed lock managers.
  - **Transactional Atomicity**: The selected row is locked and immediately updated to `status = 'CLAIMED'` with `lockedByWorkerId` and `leaseExpiresAt` in the same transaction.

---

## 3. Why Dynamic Leases & Heartbeats Are Required
- **Decision**: When a worker claims a job, it acquires a time-bounded lease (e.g., 30 seconds). The worker must send periodic heartbeats to extend `leaseExpiresAt`.
- **Rationale**:
  - **Ungraceful Crash Recovery**: If a worker process terminates abruptly (OOM, VM termination, hardware fault, network partition), it cannot send a graceful failure message.
  - **Automatic Zombie Job Reclamation**: The crash recovery supervisor queries `status IN ('CLAIMED', 'RUNNING') AND leaseExpiresAt < NOW()` and re-queues stale jobs without human intervention.

---

## 4. Why `JobExecution` is Separate From `Job`
- **Decision**: Maintain a dedicated `JobExecution` table for every individual execution attempt, distinct from the `Job` entity.
- **Rationale**:
  - **Immutable Execution History**: Retries do not overwrite previous execution metadata (start time, completion time, duration, error messages, worker host, exit codes).
  - **Flakiness & Performance Telemetry**: Allows calculating metrics like average duration per attempt, failure frequencies by worker node, and retry distributions.
  - **Worker Decommissioning Safety**: If a worker is decommissioned, foreign keys on `JobExecution.workerId` are set to `NULL`, preserving the audit history forever.

---

## 5. Idempotency Guarantees
- **Decision**: Enforce queue-scoped idempotency via `@@unique([queueId, idempotencyKey])`.
- **Rationale**:
  - Client applications retrying HTTP POST requests upon transient network drops will not create duplicate jobs.
  - PostgreSQL unique indexes prevent race conditions during concurrent ingestion requests with the same idempotency key.
