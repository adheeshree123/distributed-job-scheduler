# Distributed Job Scheduler Architecture

## 1. System Topology Overview

The Distributed Job Scheduler is engineered as a decoupled, multi-tenant distributed system comprising:

1. **API Server (`apps/api`)**: High-throughput REST service handling tenant-scoped job submissions, idempotency validation, queue administrative operations, and real-time observability.
2. **Worker Fleet (`apps/worker`)**: Independent, horizontally scalable worker instances that poll and claim executable jobs using PostgreSQL row-level locks (`SKIP LOCKED`), manage dynamic heartbeats, execute tasks concurrently, and handle graceful draining.
3. **Database Engine (`PostgreSQL + Prisma`)**: ACID-compliant source of truth maintaining relational state, execution histories, lease expiration timeouts, and dead-letter queues.
4. **Interactive Dashboard (`src/`)**: Observability and operational control console providing real-time metrics, queue management, worker health telemetry, DLQ inspection/re-driving, and cron configuration.

```
       ┌───────────────────────────────┐
       │   Client / Web Dashboard UI   │
       └──────────────┬────────────────┘
                      │ HTTP / REST
                      ▼
         ┌─────────────────────────┐
         │   API Gateway / Server  │
         │       (apps/api)        │
         └────────────┬────────────┘
                      │
                      │  ACID Transactions & Row Locks
                      ▼
        ┌───────────────────────────┐
        │  PostgreSQL (Prisma ORM)  │
        │   - Jobs Table (Indexed)  │
        │   - Queues & Workers      │
        │   - DLQ & Heartbeats      │
        └─────────────▲─────────────┘
                      │
       ┌──────────────┴──────────────┐
       │  SELECT ... FOR UPDATE      │
       │  SKIP LOCKED & Heartbeats   │
       │                             │
 ┌─────┴────────┐   ┌────────────────┴┐   ┌─────────────────┐
 │   Worker 1   │   │    Worker 2     │   │    Worker N     │
 │ (apps/worker)│   │  (apps/worker)  │   │  (apps/worker)  │
 └──────────────┘   └─────────────────┘   └─────────────────┘
```

## 2. Job Lifecycle State Machine

```
   [Job Submission]
          │
          ▼
       QUEUED  ────────(scheduledAt > NOW())───────► SCHEDULED
          │                                                │
          │ (scheduledAt <= NOW())                         │
          ▼                                                │
       CLAIMED ◄───────────────────────────────────────────┘
   (SKIP LOCKED)
          │
          ▼
       RUNNING (Lease extended via Heartbeats)
          ├──► COMPLETED (Persist Output & Duration)
          └──► FAILED
                 ├── (attemptCount < maxAttempts) ──► SCHEDULED (Backoff delay)
                 └── (attemptCount >= maxAttempts) ──► DEAD LETTER QUEUE (DLQ)
```

## 3. Concurrency & Reliability Guarantees

- **No Double-Claiming**: Row-level locking with `SELECT ... FOR UPDATE SKIP LOCKED` guarantees that no two workers can claim or lock the same job.
- **Queue Concurrency Limits**: Polling enforces active job caps per queue before claiming.
- **Lease Expiration & Crash Recovery**: If a worker process abruptly dies, its heartbeat ceases. Once `leaseExpiresAt < NOW()`, the crash recovery subsystem releases or retries the stranded job.
- **Idempotent Ingestion**: Unique database constraint on `(queueId, idempotencyKey)` prevents duplicate submissions under network retries.
