# System Design Decisions & Trade-Offs

See detailed design decisions documentation at [`docs/design-decisions.md`](./design-decisions.md).

## Key Principles
1. **PostgreSQL as Sole Source of Truth**: State transitions and claiming live in relational storage with ACID guarantees.
2. **Row-Level Locking (`SKIP LOCKED`)**: Eliminates distributed split-brain risks without external mutexes.
3. **Lease-Based Crash Recovery**: Resilient heartbeats recover stranded jobs upon worker termination.
