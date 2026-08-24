# Architecture Overview

Please refer to [`docs/architecture.md`](./docs/architecture.md) for full architectural schematics and lifecycle state machine diagrams.

### Core Architectural Pillars:
1. **API Ingestion Engine**: Validates job payloads, computes idempotency keys, and registers jobs in PostgreSQL.
2. **Autonomous Worker Daemon**: Separate runnable process pulling tasks using row locks and managing local concurrency slots.
3. **Lease Supervisor**: Continuously inspects heartbeat expiries to recover crashed jobs.
4. **Interactive Dashboard**: Modern dark-mode console displaying queue throughput, worker telemetry, and DLQ controls.
