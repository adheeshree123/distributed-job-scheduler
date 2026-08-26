import { JobStatus, ExecutionStatus, DLQStatus } from '@prisma/client';
import prisma from '../src/db/prisma.js';

export async function verifyDatabase() {
  console.log('🔍 Starting Database Schema & Verification Audit...');

  try {
    // 1. Entity Counts Verification
    const userCount = await prisma.user.count();
    const orgCount = await prisma.organization.count();
    const memberCount = await prisma.organizationMember.count();
    const projectCount = await prisma.project.count();
    const queueCount = await prisma.queue.count();
    const retryPolicyCount = await prisma.retryPolicy.count();
    const workerCount = await prisma.worker.count();
    const heartbeatCount = await prisma.workerHeartbeat.count();
    const scheduledJobCount = await prisma.scheduledJob.count();
    const jobCount = await prisma.job.count();
    const executionCount = await prisma.jobExecution.count();
    const logCount = await prisma.jobLog.count();
    const dlqCount = await prisma.deadLetterJob.count();

    console.log('\n📊 Database Entity Counts:');
    console.log(`- Users: ${userCount} (Expected: >= 2)`);
    console.log(`- Organizations: ${orgCount} (Expected: >= 1)`);
    console.log(`- Organization Memberships: ${memberCount} (Expected: >= 2)`);
    console.log(`- Projects: ${projectCount} (Expected: >= 2)`);
    console.log(`- Queues: ${queueCount} (Expected: >= 3)`);
    console.log(`- Retry Policies: ${retryPolicyCount} (Expected: >= 3)`);
    console.log(`- Workers: ${workerCount} (Expected: >= 2)`);
    console.log(`- Worker Heartbeats: ${heartbeatCount} (Expected: >= 5)`);
    console.log(`- Scheduled (Cron) Jobs: ${scheduledJobCount} (Expected: >= 2)`);
    console.log(`- Jobs: ${jobCount} (Expected: >= 15)`);
    console.log(`- Job Executions: ${executionCount} (Expected: >= 5)`);
    console.log(`- Job Logs: ${logCount} (Expected: >= 5)`);
    console.log(`- Dead Letter Queue Records: ${dlqCount} (Expected: >= 2)`);

    // 2. Status Distribution Verification
    const jobsByStatus = await prisma.job.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    console.log('\n📈 Job Distribution by Status:');
    jobsByStatus.forEach((g) => {
      console.log(`  • ${g.status}: ${g._count.id} jobs`);
    });

    // 3. Worker Claim Query Verification (Simulated Candidate Query)
    console.log('\n⚡ Simulating Worker Claim Candidate Selection:');
    const claimableCandidates = await prisma.job.findMany({
      where: {
        status: JobStatus.QUEUED,
        scheduledAt: { lte: new Date() },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      include: {
        queue: {
          select: { name: true, priority: true, concurrencyLimit: true },
        },
        retryPolicy: {
          select: { name: true, strategy: true, maxAttempts: true },
        },
      },
    });

    console.log(`Found ${claimableCandidates.length} eligible claim candidates (scheduledAt <= NOW()):`);
    claimableCandidates.forEach((job, idx) => {
      console.log(
        `  ${idx + 1}. [Priority: ${job.priority}] Job ${job.id} on Queue "${job.queue.name}" (${job.type})`
      );
    });

    // 4. Stale Lease Recovery Query Verification
    const now = new Date();
    const staleJobs = await prisma.job.findMany({
      where: {
        status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] },
        leaseExpiresAt: { lt: now },
      },
    });
    console.log(`\n⏱️ Stale Lease Recovery Check: ${staleJobs.length} expired lease candidates found.`);

    // 5. Foreign Key & Cascade Verification
    const sampleQueue = await prisma.queue.findFirst({
      include: {
        project: { include: { organization: true } },
        jobs: { take: 3 },
      },
    });

    if (sampleQueue) {
      console.log(
        `\n🔗 Foreign Key Hierarchy Check: Queue "${sampleQueue.name}" -> Project "${sampleQueue.project.name}" -> Org "${sampleQueue.project.organization.name}"`
      );
    }

    console.log('\n✅ Database Schema & Verification complete.');
    return { success: true, counts: { jobCount, dlqCount, workerCount, userCount } };
  } catch (error) {
    console.error('❌ Verification failed with error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith('verify-db.ts')) {
  verifyDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
