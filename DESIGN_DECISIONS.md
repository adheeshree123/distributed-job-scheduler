# System Design Decisions & Architectural Rationale

See the full architectural rationale in [`docs/design-decisions.md`](./docs/design-decisions.md).

## Key Pillars
1. **PostgreSQL as Single Source of Truth**: Eliminates dual-state synchronization issues.
2. **Row-Level Claiming (`SKIP LOCKED`)**: Non-blocking, atomic job claiming directly in PostgreSQL.
3. **Dynamic Leases**: Recovers zombie jobs when workers crash.
4. **Immutable Executions**: `JobExecution` preserves complete retry audit trails.
5. **Queue-Scoped Idempotency**: `@@unique([queueId, idempotencyKey])` stops duplicate submissions.
