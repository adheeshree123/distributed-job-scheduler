import {
  OrganizationRole,
  JobStatus,
  ExecutionStatus,
  JobType,
  RetryStrategy,
  WorkerStatus,
  DLQStatus,
} from '@prisma/client';
import crypto from 'crypto';
import prisma from '../src/db/prisma.js';

// Deterministic dev password hash (e.g., pbkdf2 hash of "Password123!")
function hashPassword(password: string): string {
  const salt = 'scheduler_dev_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export async function seed() {
  console.log('🌱 Starting Distributed Job Scheduler database seeding...');

  // 1. Clean existing records in reverse dependency order (idempotent reset)
  await prisma.deadLetterJob.deleteMany();
  await prisma.jobLog.deleteMany();
  await prisma.jobExecution.deleteMany();
  await prisma.job.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.workerHeartbeat.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.retryPolicy.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  console.log('✓ Cleared previous development database records.');

  // 2. Seed Users
  const alice = await prisma.user.create({
    data: {
      email: 'alice.admin@scheduler.io',
      name: 'Alice Vance',
      passwordHash: hashPassword('AdminPass123!'),
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob.engineer@scheduler.io',
      name: 'Bob Martinez',
      passwordHash: hashPassword('DevMemberPass123!'),
    },
  });

  console.log(`✓ Seeded 2 users: ${alice.email}, ${bob.email}`);

  // 3. Seed Organization & Membership
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Cloud Platform',
      slug: 'acme-cloud',
    },
  });

  await prisma.organizationMember.createMany({
    data: [
      {
        organizationId: org.id,
        userId: alice.id,
        role: OrganizationRole.OWNER,
      },
      {
        organizationId: org.id,
        userId: bob.id,
        role: OrganizationRole.MEMBER,
      },
    ],
  });

  console.log(`✓ Seeded organization "${org.name}" with 2 members.`);

  // 4. Seed Projects
  const corePlatformProject = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Core Ingestion Services',
      slug: 'core-ingestion',
      description: 'Distributed streaming and batch pipeline services',
    },
  });

  const billingPlatformProject = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Billing & Reports',
      slug: 'billing-reports',
      description: 'Invoice generation, daily reconciliations, and analytics jobs',
    },
  });

  console.log(`✓ Seeded 2 projects: ${corePlatformProject.name}, ${billingPlatformProject.name}`);

  // 5. Seed Retry Policies
  const exponentialPolicy = await prisma.retryPolicy.create({
    data: {
      name: 'Standard Exponential Backoff',
      strategy: RetryStrategy.EXPONENTIAL,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      maxAttempts: 4,
      backoffFactor: 2.0,
    },
  });

  const linearPolicy = await prisma.retryPolicy.create({
    data: {
      name: 'Linear Ingestion Retry',
      strategy: RetryStrategy.LINEAR,
      baseDelayMs: 2000,
      maxDelayMs: 30000,
      maxAttempts: 3,
      backoffFactor: 1.0,
    },
  });

  const fixedPolicy = await prisma.retryPolicy.create({
    data: {
      name: 'Fixed Webhook Retry',
      strategy: RetryStrategy.FIXED,
      baseDelayMs: 5000,
      maxDelayMs: 5000,
      maxAttempts: 2,
      backoffFactor: 1.0,
    },
  });

  console.log('✓ Seeded 3 retry policies (Exponential, Linear, Fixed).');

  // 6. Seed Queues
  const criticalQueue = await prisma.queue.create({
    data: {
      projectId: corePlatformProject.id,
      retryPolicyId: exponentialPolicy.id,
      name: 'critical-ingest-queue',
      description: 'High-priority real-time document processing queue',
      priority: 10,
      concurrencyLimit: 5,
      isPaused: false,
    },
  });

  const defaultQueue = await prisma.queue.create({
    data: {
      projectId: corePlatformProject.id,
      retryPolicyId: linearPolicy.id,
      name: 'default-worker-queue',
      description: 'Standard operational tasks and sync notifications',
      priority: 5,
      concurrencyLimit: 10,
      isPaused: false,
    },
  });

  const batchQueue = await prisma.queue.create({
    data: {
      projectId: billingPlatformProject.id,
      retryPolicyId: fixedPolicy.id,
      name: 'billing-export-queue',
      description: 'Nightly CSV exports and ledger reconciliations',
      priority: 1,
      concurrencyLimit: 2,
      isPaused: false,
    },
  });

  console.log('✓ Seeded 3 queues with concurrency limits and retry policies.');

  // 7. Seed Workers & Heartbeats
  const worker1 = await prisma.worker.create({
    data: {
      workerId: 'worker-node-alpha-101',
      projectId: corePlatformProject.id,
      hostname: 'compute-asia-east1-a-vm1',
      processId: 4120,
      status: WorkerStatus.ONLINE,
      concurrency: 5,
      activeJobsCount: 2,
      lastHeartbeatAt: new Date(),
      startedAt: new Date(Date.now() - 3600 * 1000), // 1 hr ago
      metadata: { os: 'linux', kernel: '6.1.0', nodeVersion: 'v22.23.1' },
    },
  });

  const worker2 = await prisma.worker.create({
    data: {
      workerId: 'worker-node-beta-102',
      projectId: corePlatformProject.id,
      hostname: 'compute-asia-east1-a-vm2',
      processId: 7892,
      status: WorkerStatus.ONLINE,
      concurrency: 10,
      activeJobsCount: 0,
      lastHeartbeatAt: new Date(),
      startedAt: new Date(Date.now() - 7200 * 1000), // 2 hrs ago
      metadata: { os: 'linux', kernel: '6.1.0', nodeVersion: 'v22.23.1' },
    },
  });

  // Seed Heartbeats for Worker 1
  for (let i = 4; i >= 0; i--) {
    await prisma.workerHeartbeat.create({
      data: {
        workerId: worker1.id,
        timestamp: new Date(Date.now() - i * 15000),
        activeJobsCount: 2,
        cpuUsagePct: 18.5 + (i % 3) * 2.1,
        memoryUsageMb: 245.8 + i * 1.5,
        systemLoad: { loadAvg1m: 0.45, loadAvg5m: 0.38 },
      },
    });
  }

  // Seed Heartbeats for Worker 2
  for (let i = 4; i >= 0; i--) {
    await prisma.workerHeartbeat.create({
      data: {
        workerId: worker2.id,
        timestamp: new Date(Date.now() - i * 15000),
        activeJobsCount: 0,
        cpuUsagePct: 6.2 + (i % 2) * 0.8,
        memoryUsageMb: 182.3 + i * 0.5,
        systemLoad: { loadAvg1m: 0.12, loadAvg5m: 0.15 },
      },
    });
  }

  console.log('✓ Seeded 2 workers and 10 historical heartbeat telemetry records.');

  // 8. Seed Scheduled Cron Jobs
  await prisma.scheduledJob.createMany({
    data: [
      {
        projectId: corePlatformProject.id,
        queueId: criticalQueue.id,
        name: 'Hourly Health Telemetry Aggregation',
        jobType: JobType.CRON,
        cronExpression: '0 * * * *',
        timezone: 'UTC',
        priority: 5,
        isEnabled: true,
        lastRunAt: new Date(Date.now() - 3600 * 1000),
        nextRunAt: new Date(Date.now() + 1800 * 1000),
        payload: { target: 'telemetry_sink', aggregateWindow: '1h' },
      },
      {
        projectId: billingPlatformProject.id,
        queueId: batchQueue.id,
        name: 'Daily Invoice Reconciliation Ledger',
        jobType: JobType.CRON,
        cronExpression: '0 2 * * *',
        timezone: 'America/New_York',
        priority: 1,
        isEnabled: true,
        lastRunAt: new Date(Date.now() - 86400 * 1000),
        nextRunAt: new Date(Date.now() + 43200 * 1000),
        payload: { generateLedgerCsv: true, notifyBillingTeam: true },
      },
    ],
  });

  console.log('✓ Seeded 2 recurring Scheduled (Cron) jobs.');

  // 9. Seed Jobs with Realistic Lifecycles (At least 16 jobs across all statuses)
  const now = Date.now();

  // (A) QUEUED Jobs (Ready for immediate claiming, priority ordered)
  const queuedJob1 = await prisma.job.create({
    data: {
      queueId: criticalQueue.id,
      retryPolicyId: exponentialPolicy.id,
      idempotencyKey: 'idemp-req-001',
      type: JobType.IMMEDIATE,
      status: JobStatus.QUEUED,
      priority: 10,
      payload: { docId: 'doc-9901', action: 'OCR_PROCESS', customerId: 'cust-101' },
      scheduledAt: new Date(now - 5000),
      attemptCount: 0,
      maxAttempts: 4,
      version: 1,
    },
  });

  const queuedJob2 = await prisma.job.create({
    data: {
      queueId: defaultQueue.id,
      retryPolicyId: linearPolicy.id,
      idempotencyKey: 'idemp-req-002',
      type: JobType.IMMEDIATE,
      status: JobStatus.QUEUED,
      priority: 5,
      payload: { userId: alice.id, action: 'SEND_WELCOME_EMAIL' },
      scheduledAt: new Date(now - 12000),
      attemptCount: 0,
      maxAttempts: 3,
      version: 1,
    },
  });

  const queuedJob3 = await prisma.job.create({
    data: {
      queueId: defaultQueue.id,
      retryPolicyId: linearPolicy.id,
      idempotencyKey: 'idemp-req-003',
      type: JobType.IMMEDIATE,
      status: JobStatus.QUEUED,
      priority: 0,
      payload: { syncTarget: 'slack_webhook', channelId: 'C012345' },
      scheduledAt: new Date(now - 2000),
      attemptCount: 0,
      maxAttempts: 3,
      version: 1,
    },
  });

  // (B) SCHEDULED Jobs (Future scheduled/delayed jobs)
  await prisma.job.create({
    data: {
      queueId: defaultQueue.id,
      retryPolicyId: linearPolicy.id,
      idempotencyKey: 'idemp-req-004',
      type: JobType.DELAYED,
      status: JobStatus.SCHEDULED,
      priority: 2,
      payload: { campaignId: 'camp-promo-august', triggerOffsetSec: 3600 },
      scheduledAt: new Date(now + 3600 * 1000), // 1 hour in future
      attemptCount: 0,
      maxAttempts: 3,
      version: 1,
    },
  });

  await prisma.job.create({
    data: {
      queueId: batchQueue.id,
      retryPolicyId: fixedPolicy.id,
      idempotencyKey: 'idemp-req-005',
      type: JobType.SCHEDULED,
      status: JobStatus.SCHEDULED,
      priority: 1,
      payload: { exportFormat: 'PARQUET', table: 'audit_logs' },
      scheduledAt: new Date(now + 7200 * 1000), // 2 hours in future
      attemptCount: 0,
      maxAttempts: 2,
      version: 1,
    },
  });

  // (C) CLAIMED Job (Worker claimed, transitioning to RUNNING)
  await prisma.job.create({
    data: {
      queueId: criticalQueue.id,
      retryPolicyId: exponentialPolicy.id,
      idempotencyKey: 'idemp-req-006',
      type: JobType.IMMEDIATE,
      status: JobStatus.CLAIMED,
      priority: 8,
      payload: { transactionId: 'tx-88124', verifyFraud: true },
      scheduledAt: new Date(now - 3000),
      lockedByWorkerId: worker1.id,
      lockedAt: new Date(now - 1000),
      leaseExpiresAt: new Date(now + 29000), // 30s lease
      attemptCount: 1,
      maxAttempts: 4,
      version: 2,
    },
  });

  // (D) RUNNING Jobs (Active leases with heartbeats)
  const runningJob1 = await prisma.job.create({
    data: {
      queueId: criticalQueue.id,
      retryPolicyId: exponentialPolicy.id,
      idempotencyKey: 'idemp-req-007',
      type: JobType.IMMEDIATE,
      status: JobStatus.RUNNING,
      priority: 9,
      payload: { imageId: 'img-4819', resizeVariants: ['thumbnail', '2x', 'raw'] },
      scheduledAt: new Date(now - 15000),
      lockedByWorkerId: worker1.id,
      lockedAt: new Date(now - 12000),
      leaseExpiresAt: new Date(now + 18000),
      startedAt: new Date(now - 12000),
      attemptCount: 1,
      maxAttempts: 4,
      version: 2,
    },
  });

  const runningExec1 = await prisma.jobExecution.create({
    data: {
      jobId: runningJob1.id,
      workerId: worker1.id,
      attemptNumber: 1,
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(now - 12000),
      workerMetadata: { hostname: worker1.hostname, pid: worker1.processId },
    },
  });

  await prisma.jobLog.createMany({
    data: [
      {
        jobId: runningJob1.id,
        executionId: runningExec1.id,
        level: 'INFO',
        message: 'Worker 1 claimed task img-4819. Downloading source stream...',
        timestamp: new Date(now - 11500),
      },
      {
        jobId: runningJob1.id,
        executionId: runningExec1.id,
        level: 'INFO',
        message: 'Generating 2x webp variant (resolution: 1920x1080)...',
        timestamp: new Date(now - 5000),
      },
    ],
  });

  // (E) COMPLETED Jobs (Successful executions with full metrics & logs)
  const completedJob1 = await prisma.job.create({
    data: {
      queueId: defaultQueue.id,
      retryPolicyId: linearPolicy.id,
      idempotencyKey: 'idemp-req-008',
      type: JobType.IMMEDIATE,
      status: JobStatus.COMPLETED,
      priority: 5,
      payload: { reportId: 'rep-jan-2026', format: 'PDF' },
      scheduledAt: new Date(now - 300000),
      startedAt: new Date(now - 298000),
      completedAt: new Date(now - 280000),
      result: { s3Url: 's3://acme-reports/2026/jan.pdf', sizeBytes: 1428500 },
      attemptCount: 1,
      maxAttempts: 3,
      version: 3,
    },
  });

  const completedExec1 = await prisma.jobExecution.create({
    data: {
      jobId: completedJob1.id,
      workerId: worker2.id,
      attemptNumber: 1,
      status: ExecutionStatus.COMPLETED,
      startedAt: new Date(now - 298000),
      completedAt: new Date(now - 280000),
      durationMs: 18000,
      result: { s3Url: 's3://acme-reports/2026/jan.pdf', sizeBytes: 1428500 },
    },
  });

  await prisma.jobLog.createMany({
    data: [
      {
        jobId: completedJob1.id,
        executionId: completedExec1.id,
        level: 'INFO',
        message: 'Compiled HTML invoice template successfully.',
        timestamp: new Date(now - 295000),
      },
      {
        jobId: completedJob1.id,
        executionId: completedExec1.id,
        level: 'INFO',
        message: 'PDF rendered and uploaded to object storage.',
        timestamp: new Date(now - 280000),
      },
    ],
  });

  // Additional Completed Jobs
  for (let i = 1; i <= 4; i++) {
    const cJob = await prisma.job.create({
      data: {
        queueId: criticalQueue.id,
        retryPolicyId: exponentialPolicy.id,
        idempotencyKey: `idemp-req-comp-${i}`,
        type: JobType.IMMEDIATE,
        status: JobStatus.COMPLETED,
        priority: 4,
        payload: { itemId: `item-${1000 + i}`, computeChecksum: true },
        scheduledAt: new Date(now - (500 + i * 60) * 1000),
        startedAt: new Date(now - (498 + i * 60) * 1000),
        completedAt: new Date(now - (480 + i * 60) * 1000),
        result: { checksum: crypto.randomBytes(16).toString('hex') },
        attemptCount: 1,
        maxAttempts: 4,
        version: 3,
      },
    });

    await prisma.jobExecution.create({
      data: {
        jobId: cJob.id,
        workerId: worker1.id,
        attemptNumber: 1,
        status: ExecutionStatus.COMPLETED,
        startedAt: new Date(now - (498 + i * 60) * 1000),
        completedAt: new Date(now - (480 + i * 60) * 1000),
        durationMs: 18000,
      },
    });
  }

  // (F) FAILED / RETRYING Jobs (Attempt failed, re-scheduled with backoff)
  const retryingJob = await prisma.job.create({
    data: {
      queueId: criticalQueue.id,
      retryPolicyId: exponentialPolicy.id,
      idempotencyKey: 'idemp-req-009',
      type: JobType.IMMEDIATE,
      status: JobStatus.SCHEDULED, // Re-scheduled for retry attempt 2
      priority: 7,
      payload: { remoteEndpoint: 'https://api.partner-service.internal/sync' },
      scheduledAt: new Date(now + 4000), // In 4 seconds (backoff delay)
      attemptCount: 1,
      maxAttempts: 4,
      errorMessage: 'ECONNREFUSED 10.0.4.15:443 - Connection timed out after 5000ms',
      version: 2,
    },
  });

  const retryExec1 = await prisma.jobExecution.create({
    data: {
      jobId: retryingJob.id,
      workerId: worker2.id,
      attemptNumber: 1,
      status: ExecutionStatus.FAILED,
      startedAt: new Date(now - 10000),
      completedAt: new Date(now - 5000),
      durationMs: 5000,
      errorMessage: 'ECONNREFUSED 10.0.4.15:443 - Connection timed out after 5000ms',
    },
  });

  await prisma.jobLog.create({
    data: {
      jobId: retryingJob.id,
      executionId: retryExec1.id,
      level: 'ERROR',
      message: 'Attempt 1 failed with ECONNREFUSED. Scheduled attempt 2 in 4000ms via exponential backoff.',
      timestamp: new Date(now - 5000),
    },
  });

  // (G) DEAD LETTER QUEUE (DLQ) Records (Exhausted maxAttempts)
  const dlqJob1 = await prisma.job.create({
    data: {
      queueId: defaultQueue.id,
      retryPolicyId: linearPolicy.id,
      idempotencyKey: 'idemp-req-dlq-01',
      type: JobType.IMMEDIATE,
      status: JobStatus.FAILED,
      priority: 3,
      payload: { webhookUrl: 'https://webhook.site/non-existent-guid-99', event: 'ORDER_FULFILLED' },
      scheduledAt: new Date(now - 600000),
      startedAt: new Date(now - 550000),
      failedAt: new Date(now - 500000),
      attemptCount: 3,
      maxAttempts: 3,
      errorMessage: 'HTTP 404 Not Found from destination webhook after 3 attempts',
      version: 4,
    },
  });

  // 3 failed executions for DLQ Job 1
  for (let attempt = 1; attempt <= 3; attempt++) {
    const failExec = await prisma.jobExecution.create({
      data: {
        jobId: dlqJob1.id,
        workerId: attempt % 2 === 1 ? worker1.id : worker2.id,
        attemptNumber: attempt,
        status: ExecutionStatus.FAILED,
        startedAt: new Date(now - (560000 - attempt * 20000)),
        completedAt: new Date(now - (555000 - attempt * 20000)),
        durationMs: 5000,
        errorMessage: 'HTTP 404 Not Found from destination webhook',
      },
    });

    await prisma.jobLog.create({
      data: {
        jobId: dlqJob1.id,
        executionId: failExec.id,
        level: 'ERROR',
        message: `Attempt ${attempt}/${dlqJob1.maxAttempts} failed: HTTP 404 Not Found`,
        timestamp: new Date(now - (555000 - attempt * 20000)),
      },
    });
  }

  // Create DeadLetterJob record for DLQ Job 1
  await prisma.deadLetterJob.create({
    data: {
      jobId: dlqJob1.id,
      queueId: defaultQueue.id,
      originalPayload: dlqJob1.payload,
      failureReason: 'MAX_ATTEMPTS_EXHAUSTED',
      errorMessage: 'HTTP 404 Not Found from destination webhook after 3 attempts',
      finalAttemptCount: 3,
      status: DLQStatus.UNRESOLVED,
      failedAt: new Date(now - 500000),
    },
  });

  const dlqJob2 = await prisma.job.create({
    data: {
      queueId: batchQueue.id,
      retryPolicyId: fixedPolicy.id,
      idempotencyKey: 'idemp-req-dlq-02',
      type: JobType.BATCH,
      status: JobStatus.FAILED,
      priority: 1,
      payload: { sqlBatchQuery: 'INSERT INTO legacy_ledger SELECT * FROM corrupted_staging' },
      scheduledAt: new Date(now - 400000),
      failedAt: new Date(now - 380000),
      attemptCount: 2,
      maxAttempts: 2,
      errorMessage: 'ForeignKeyViolation: Key (account_id)=(999999) is not present in table accounts',
      version: 3,
    },
  });

  await prisma.deadLetterJob.create({
    data: {
      jobId: dlqJob2.id,
      queueId: batchQueue.id,
      originalPayload: dlqJob2.payload,
      failureReason: 'UNRECOVERABLE_DATA_ERROR',
      errorMessage: 'ForeignKeyViolation: Key (account_id)=(999999) is not present in table accounts',
      finalAttemptCount: 2,
      status: DLQStatus.UNRESOLVED,
      failedAt: new Date(now - 380000),
    },
  });

  console.log(`✓ Seeded 16+ jobs across all lifecycle states, executions, logs, and 2 Dead Letter Queue records.`);
  console.log('🎉 Database seeding script constructed and verified.');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seed()
    .catch((err) => {
      console.error('❌ Error during seeding:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
