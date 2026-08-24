# Distributed Job Scheduler

A production-grade distributed job scheduler and execution engine engineered for high-concurrency, fault-tolerant asynchronous workloads.

## Key Features

- **Decoupled Architecture**: Independent REST API Gateway (`apps/api`), Autonomous Worker Fleet (`apps/worker`), and Real-time Dashboard (`src/`).
- **PostgreSQL Source of Truth**: Full relational schema with Prisma ORM.
- **Atomic Job Claiming**: Transactional `SELECT ... FOR UPDATE SKIP LOCKED` guarantees zero duplicate executions.
- **Lease-Based Crash Recovery**: Resilient heartbeat leases automatically recover stale or stranded jobs upon worker termination.
- **Queue Concurrency Control**: Strict per-queue concurrency enforcement preventing downstream service overload.
- **Multi-Tenant Scoping**: Role-based access control (RBAC) across Organizations, Projects, and Queues.
- **Dead Letter Queue (DLQ)**: Automatic routing with configurable exponential, linear, and fixed retry backoff policies.
- **Cron & Scheduled Jobs**: Database-backed recurring cron trigger engine.
- **OpenAPI & Swagger**: Fully typed and interactive API specifications at `/api/docs`.

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Start API server & Dashboard (Port 3000)
npm run dev

# Run Worker Process
npm run worker

# Run Test Suite
npm test
```
