# Database Schema & Storage Strategy

See detailed database documentation at [`docs/database.md`](./database.md) and [`prisma/schema.prisma`](../prisma/schema.prisma).

## Entities
- `User`, `Organization`, `OrganizationMember`
- `Project`, `Queue`, `RetryPolicy`
- `Job`, `JobExecution`, `JobLog`
- `Worker`, `WorkerHeartbeat`
- `ScheduledJob`, `DeadLetterJob`
