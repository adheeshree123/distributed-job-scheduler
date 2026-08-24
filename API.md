# Distributed Job Scheduler REST API Specification

Interactive Swagger UI is accessible at `/api/docs`.

## Endpoints Overview

| Method | Endpoint | Description | Security |
|--------|----------|-------------|----------|
| `GET` | `/api/health` | Service health status | Public |
| `GET` | `/api/info` | Distributed architecture metadata | Public |
| `GET` | `/api/docs` | OpenAPI Swagger documentation | Public |
| `POST` | `/api/auth/register` | Create tenant user account | Public |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT | Public |
| `GET` | `/api/auth/me` | Fetch active user context | Bearer JWT |
| `GET` | `/api/queues` | List tenant queues | Bearer JWT |
| `POST` | `/api/queues` | Create project queue | Bearer JWT |
| `POST` | `/api/jobs` | Enqueue single job (idempotent) | Bearer JWT |
| `POST` | `/api/jobs/batch` | Atomic batch job ingestion | Bearer JWT |
| `GET` | `/api/jobs` | Query & filter jobs by state | Bearer JWT |
| `GET` | `/api/workers` | Inspect worker fleet & heartbeats | Bearer JWT |
| `GET` | `/api/dlq` | List dead-letter jobs | Bearer JWT |
| `POST` | `/api/dlq/:id/retry`| Replay dead-letter job | Bearer JWT |
| `GET` | `/api/scheduled` | List recurring cron jobs | Bearer JWT |
