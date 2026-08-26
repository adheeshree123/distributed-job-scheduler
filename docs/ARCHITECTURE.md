# System Architecture Specification

See detailed architectural documentation at [`docs/architecture.md`](./architecture.md).

## System Components
1. **API Gateway (`apps/api`)**: High-throughput REST API with OpenAPI/Swagger documentation.
2. **Worker Daemon (`apps/worker`)**: Independent, horizontally scalable worker instances.
3. **Database Engine (`PostgreSQL + Prisma`)**: Single source of truth with row-level locks (`SKIP LOCKED`).
4. **Dashboard (`apps/frontend`)**: Real-time management and observability console.
