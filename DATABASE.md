# Database Architecture & Entity Specifications

Please refer to [`docs/database.md`](./docs/database.md) and [`prisma/schema.prisma`](./prisma/schema.prisma) for the normalized relational schema, indexes, and relations.

### Entities:
- `User`, `Organization`, `OrganizationMember`
- `Project`, `Queue`, `RetryPolicy`
- `Job`, `JobExecution`, `JobLog`
- `Worker`, `WorkerHeartbeat`
- `ScheduledJob`, `DeadLetterJob`
