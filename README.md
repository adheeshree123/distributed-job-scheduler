# Distributed Job Scheduler

A production-grade distributed job scheduler and asynchronous execution engine built for high-concurrency, fault-tolerant workloads with PostgreSQL, Prisma ORM, and TypeScript.

---

## 🏛️ System Architecture

The architecture is strictly decoupled into three core operational layers:

```
┌─────────────────────────────────────────────────────────────┐
│                   React Management Console                  │
│       (Interactive Metrics, Queue & Worker Observability)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON
┌──────────────────────────────▼──────────────────────────────┐
│                    API Gateway Service                      │
│   (Auth, RBAC, Rate Limiting, Idempotency, Job Ingestion)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Prisma ORM / PostgreSQL Pools
┌──────────────────────────────▼──────────────────────────────┐
│              PostgreSQL Relational Storage                  │
│  (State Machine, Row-Level FOR UPDATE SKIP LOCKED Locks)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Atomic Claims & Leases
┌──────────────────────────────▼──────────────────────────────┐
│             Autonomous Distributed Worker Fleet             │
│   (Heartbeats, Leases, Concurrency Limits, Retries & DLQ)   │
└─────────────────────────────────────────────────────────────┘
```

1. **API Ingestion Service (`apps/api`)**: High-throughput REST API gateway enforcing tenant isolation, role-based access control, cryptographic payload validation, idempotency caching, and OpenAPI specifications.
2. **PostgreSQL Relational Engine**: Serves as the single source of truth using PostgreSQL row-level locks (`SELECT ... FOR UPDATE OF j SKIP LOCKED`) for deterministic, zero-duplicate job claims.
3. **Autonomous Worker Fleet (`apps/worker`)**: Distributed worker processes managing configurable local execution slots, lease renewals, heartbeat monitoring, automated retry backoff scheduling, and dead letter queue routing.
4. **Management Dashboard (`src/`)**: Real-time observability UI displaying queue throughput, active worker fleet health, job execution histories, and dead letter queue replay controls.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **PostgreSQL Database**: Neon PostgreSQL / standard PostgreSQL instance (14+)

### 2. Environment Configuration
Create a `.env` file from the provided template:

```bash
cp .env.example .env
```

Configure your environment variables:

| Variable | Description | Default / Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?schema=public` |
| `JWT_SECRET` | Secret key used for signing auth tokens | `your-secure-jwt-secret-min-32-chars` |
| `JWT_EXPIRES_IN` | Token lifespan | `7d` |
| `WORKER_CONCURRENCY` | Maximum concurrent job executions per worker instance | `5` |
| `WORKER_POLL_INTERVAL_MS` | Job polling cadence in milliseconds | `1000` |
| `WORKER_HEARTBEAT_INTERVAL_MS` | Heartbeat recording interval | `5000` |
| `WORKER_LEASE_DURATION_SECONDS` | Claim lease TTL in seconds | `30` |

---

## 📦 Database Setup & Migration

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npm run prisma:generate

# 3. Apply database migrations
npx prisma migrate deploy

# 4. (Optional) Seed demo organizations, users, and queues
npm run prisma:seed

# 5. Verify database integrity
npm run prisma:verify
```

---

## 🏃 Running the Services

### Running the API Gateway & Management Dashboard
Starts the Express API server and React frontend on port `3000`:
```bash
npm run dev
```
- **Dashboard UI**: `http://localhost:3000`
- **Interactive OpenAPI / Swagger Docs**: `http://localhost:3000/api/docs`

### Running the Autonomous Distributed Worker
Start an autonomous worker node to process jobs:
```bash
npm run worker
```

To run multiple worker nodes simultaneously in separate terminals:
```bash
WORKER_ID=worker-node-1 WORKER_CONCURRENCY=5 npm run worker
WORKER_ID=worker-node-2 WORKER_CONCURRENCY=10 npm run worker
```

---

## 🧪 Testing & Verification

Run the full end-to-end verification and integration test suite:

```bash
# Run all test suites
npm test

# Type checking / Linting
npm run lint

# Production build
npm run build
```

---

## 🔒 Concurrency & Reliability Guarantees

- **Atomic Job Claims**: PostgreSQL Common Table Expressions (CTE) execute `FOR UPDATE SKIP LOCKED` on eligible queued jobs, completely eliminating duplicate job dispatch and race conditions across distributed workers.
- **Queue Concurrency Enforcement**: Concurrency limits are evaluated directly within the atomic claim SQL query, guaranteeing queues never exceed their configured capacity even under high contention.
- **Lease Heartbeat & Crash Recovery**: Workers actively extend job leases via background heartbeat timers. If a worker crashes or becomes partitioned, the supervisor detects the expired lease and transitions the job for retry or Dead Letter Queue routing.
- **Configurable Backoff & DLQ**: Supports `FIXED`, `LINEAR`, and `EXPONENTIAL` backoff strategies with jitter. Once max retry attempts are exhausted, failed jobs are moved to the Dead Letter Queue for inspection and manual or automated replay.
