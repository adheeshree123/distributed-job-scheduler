import {
  OrganizationRole,
  JobStatus,
  ExecutionStatus,
  JobType,
  RetryStrategy,
  WorkerStatus,
  DLQStatus,
  Prisma,
} from '@prisma/client';
import fs from 'fs';
import path from 'path';

describe('Database Schema & Entities Specification (Phase 2)', () => {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '20260824000000_init', 'migration.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  test('Prisma schema exists and declares all 13 core models', () => {
    const requiredModels = [
      'model User',
      'model Organization',
      'model OrganizationMember',
      'model Project',
      'model Queue',
      'model RetryPolicy',
      'model Job',
      'model JobExecution',
      'model JobLog',
      'model Worker',
      'model WorkerHeartbeat',
      'model ScheduledJob',
      'model DeadLetterJob',
    ];

    requiredModels.forEach((modelDecl) => {
      expect(schemaContent).toContain(modelDecl);
    });
  });

  test('Enums match exact state machine definitions', () => {
    expect(OrganizationRole.OWNER).toBe('OWNER');
    expect(OrganizationRole.ADMIN).toBe('ADMIN');
    expect(OrganizationRole.MEMBER).toBe('MEMBER');

    expect(JobStatus.QUEUED).toBe('QUEUED');
    expect(JobStatus.SCHEDULED).toBe('SCHEDULED');
    expect(JobStatus.CLAIMED).toBe('CLAIMED');
    expect(JobStatus.RUNNING).toBe('RUNNING');
    expect(JobStatus.COMPLETED).toBe('COMPLETED');
    expect(JobStatus.FAILED).toBe('FAILED');
    expect(JobStatus.CANCELLED).toBe('CANCELLED');

    expect(ExecutionStatus.RUNNING).toBe('RUNNING');
    expect(ExecutionStatus.COMPLETED).toBe('COMPLETED');
    expect(ExecutionStatus.FAILED).toBe('FAILED');

    expect(RetryStrategy.FIXED).toBe('FIXED');
    expect(RetryStrategy.LINEAR).toBe('LINEAR');
    expect(RetryStrategy.EXPONENTIAL).toBe('EXPONENTIAL');

    expect(WorkerStatus.ONLINE).toBe('ONLINE');
    expect(WorkerStatus.DRAINING).toBe('DRAINING');
    expect(WorkerStatus.OFFLINE).toBe('OFFLINE');

    expect(DLQStatus.UNRESOLVED).toBe('UNRESOLVED');
    expect(DLQStatus.RETRIED).toBe('RETRIED');
    expect(DLQStatus.DISCARDED).toBe('DISCARDED');
  });

  test('Critical indexes for SKIP LOCKED and lease recovery are present', () => {
    // Worker claim index: (queueId, status, scheduledAt, priority, createdAt)
    expect(schemaContent).toContain('@@index([queueId, status, scheduledAt, priority, createdAt])');

    // Lease crash recovery index: (status, leaseExpiresAt)
    expect(schemaContent).toContain('@@index([status, leaseExpiresAt])');

    // Idempotency composite unique: (queueId, idempotencyKey)
    expect(schemaContent).toContain('@@unique([queueId, idempotencyKey])');

    // Queue uniqueness within project: (projectId, name)
    expect(schemaContent).toContain('@@unique([projectId, name])');

    // Project uniqueness within org: (organizationId, name)
    expect(schemaContent).toContain('@@unique([organizationId, name])');

    // Org member composite unique: (organizationId, userId)
    expect(schemaContent).toContain('@@unique([organizationId, userId])');

    // Scheduled job index: (isEnabled, nextRunAt)
    expect(schemaContent).toContain('@@index([isEnabled, nextRunAt])');

    // Worker heartbeat index: (workerId, timestamp)
    expect(schemaContent).toContain('@@index([workerId, timestamp])');
  });

  test('Cascade deletion vs historical preservation rules are configured', () => {
    // Organization -> OrganizationMember (Cascade)
    expect(schemaContent).toMatch(/organization\s+Organization\s+@relation\(.*onDelete:\s*Cascade/);

    // Organization -> Project (Cascade)
    expect(schemaContent).toMatch(/organization\s+Organization\s+@relation\(.*onDelete:\s*Cascade/);

    // Queue -> Job (Cascade)
    expect(schemaContent).toMatch(/queue\s+Queue\s+@relation\(.*onDelete:\s*Cascade/);

    // JobExecution -> Worker (SetNull to preserve execution history upon worker decommissioning)
    expect(schemaContent).toMatch(/worker\s+Worker\?\s+@relation\(.*onDelete:\s*SetNull/);

    // Job -> lockedByWorker (SetNull)
    expect(schemaContent).toMatch(/lockedByWorker\s+Worker\?\s+@relation\(.*onDelete:\s*SetNull/);

    // Queue -> RetryPolicy (SetNull)
    expect(schemaContent).toMatch(/retryPolicy\s+RetryPolicy\?\s+@relation\(.*onDelete:\s*SetNull/);
  });

  test('PostgreSQL migration script exists and has valid DDL statements', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    expect(migrationSql).toContain('CREATE TYPE "JobStatus"');
    expect(migrationSql).toContain('CREATE TABLE "Job"');
    expect(migrationSql).toContain('CREATE TABLE "Worker"');
    expect(migrationSql).toContain('CREATE TABLE "DeadLetterJob"');
    expect(migrationSql).toContain('Job_queueId_status_scheduledAt_priority_createdAt_idx');
    expect(migrationSql).toContain('Job_status_leaseExpiresAt_idx');
  });
});
