import React from 'react';
import {
  Database,
  Lock,
  Heart,
  RotateCcw,
  Zap,
  Code,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">System & Architecture Specs</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Technical Reference
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Explore the underlying distributed primitives, atomic concurrency algorithms, and database schema guarantees.
          </p>
        </div>

        <a
          href="/api-docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200 transition cursor-pointer self-start md:self-auto"
        >
          <span>Open Swagger / OpenAPI Docs</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Grid of Key Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Row Locking */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Lock className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Atomic SKIP LOCKED Claiming</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Workers query PostgreSQL inside transactions using <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded font-mono font-semibold">SELECT ... FOR UPDATE SKIP LOCKED</code>. Multiple concurrent worker instances never block or duplicate claims.
          </p>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700">
            Isolation: Read Committed + Row Locks
          </div>
        </div>

        {/* Dynamic Leases */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
            <Heart className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Heartbeat Lease Renewal</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Running tasks obtain a 30-second execution lease renewed every 5 seconds. If a worker process crashes, its lease expires, and the recovery sweeper reclaims the job automatically.
          </p>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700">
            Lease TTL: 30s • Heartbeat: 5s
          </div>
        </div>

        {/* Backoff & DLQ */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <RotateCcw className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Exponential Backoff & DLQ</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Failed jobs evaluate customizable retry strategies (<code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono">delay = base * factor^(attempt-1)</code>). Upon exhausting retries, jobs move to the Dead Letter Queue.
          </p>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700">
            Strategies: EXPONENTIAL, LINEAR, FIXED
          </div>
        </div>
      </div>

      {/* Relational Schema Specs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
          <Database className="h-4 w-4 text-indigo-600" />
          <span>PostgreSQL Relational Schema & Tables</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          The database schema is fully managed via Prisma ORM 7 with PostgreSQL Neon driver adapter. Composite indices on <code className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono font-semibold">[queueId, status, scheduledAt, priority]</code> guarantee low latency sub-millisecond query execution.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-2">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">Table</span>
            <span className="text-slate-800 font-bold">Job</span>
            <span className="text-[11px] text-slate-500 block font-sans mt-0.5">Primary task records</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">Table</span>
            <span className="text-slate-800 font-bold">JobExecution</span>
            <span className="text-[11px] text-slate-500 block font-sans mt-0.5">Attempt history & timing</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">Table</span>
            <span className="text-slate-800 font-bold">DeadLetterJob</span>
            <span className="text-[11px] text-slate-500 block font-sans mt-0.5">Quarantined failures</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">Table</span>
            <span className="text-slate-800 font-bold">WorkerHeartbeat</span>
            <span className="text-[11px] text-slate-500 block font-sans mt-0.5">Fleet health records</span>
          </div>
        </div>
      </div>
    </div>
  );
};
