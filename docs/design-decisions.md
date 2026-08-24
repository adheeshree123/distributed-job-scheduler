# System Design Decisions & Trade-Offs

## 1. Relational Database as Single Source of Truth
- **Decision**: Use PostgreSQL + Prisma ORM instead of in-memory or document stores.
- **Rationale**: Distributed job coordination requires strong ACID transactions, row-level locks (`SKIP LOCKED`), and unique composite constraints that guarantee consistency across horizontal worker fleets.

## 2. Row-Level Locking (`SELECT FOR UPDATE SKIP LOCKED`) vs. Distributed Mutex (Redis)
- **Decision**: Worker polling claims jobs directly via PostgreSQL transactional row locks.
- **Rationale**: Bypasses the split-brain and coordination drift risks inherent in maintaining two separate state machines (e.g. Redis + DB). PostgreSQL remains the unified authority.

## 3. Dynamic Leases & Heartbeat Extensions
- **Decision**: Assign a 30-second expiring lease upon claiming, renewed continuously while active.
- **Rationale**: Prevents job loss during ungraceful worker termination, network partitions, or container restarts without requiring external consensus brokers.

## 4. Multi-Tenant Role-Based Access
- **Decision**: Every resource (Project, Queue, Job, Worker) is strictly scoped under Organization boundaries with `OWNER`, `ADMIN`, and `MEMBER` roles.
