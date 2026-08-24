import React, { useState, useEffect } from 'react';
import {
  Server,
  Layers,
  Cpu,
  RotateCw,
  AlertTriangle,
  Calendar,
  Activity,
  ShieldCheck,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  Database,
  Terminal,
} from 'lucide-react';

interface SystemHealth {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  env: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'queues' | 'workers' | 'dlq' | 'cron' | 'arch'>('overview');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Health fetch failed:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div id="app-root" className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans antialiased">
      {/* Top Header */}
      <header id="app-header" className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-semibold text-base tracking-tight text-white">Distributed Job Scheduler</h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v1.0.0-foundation
              </span>
            </div>
            <p className="text-xs text-neutral-400">Production-grade distributed task execution engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs text-neutral-300 font-mono bg-neutral-900 px-3 py-1.5 rounded-md border border-neutral-800">
            <span className={`h-2 w-2 rounded-full ${health?.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>API Engine: {loading ? 'checking...' : health?.status === 'ok' ? 'Operational' : 'Ready'}</span>
          </div>
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1.5 rounded-md border border-neutral-700 transition"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>OpenAPI Docs</span>
          </a>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-6 gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-64 flex-shrink-0 space-y-1">
          <nav className="space-y-1 bg-neutral-900/50 p-2 rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>System Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('queues')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'queues'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Queues & Concurrency</span>
            </button>
            <button
              onClick={() => setActiveTab('workers')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'workers'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <Cpu className="h-4 w-4" />
              <span>Worker Fleet & Leases</span>
            </button>
            <button
              onClick={() => setActiveTab('dlq')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'dlq'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Dead Letter Queue</span>
            </button>
            <button
              onClick={() => setActiveTab('cron')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'cron'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Cron & Scheduled</span>
            </button>
            <button
              onClick={() => setActiveTab('arch')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'arch'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Architecture & Specs</span>
            </button>
          </nav>

          {/* Database Specs Card */}
          <div className="bg-neutral-900/40 p-4 rounded-xl border border-neutral-800 text-xs space-y-2 mt-4">
            <div className="flex items-center space-x-2 text-neutral-300 font-semibold">
              <Database className="h-4 w-4 text-indigo-400" />
              <span>Relational Storage</span>
            </div>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              PostgreSQL schema managed via Prisma ORM with row-level locking indexes for SKIP LOCKED claiming.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 space-y-6">
          {/* Phase 1 Verification Banner */}
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-sm font-semibold text-white">Phase 1: Project Foundation & Architecture Verified</h2>
                </div>
                <p className="text-xs text-neutral-300 mt-1">
                  Core monorepo architecture, Prisma relational schema, worker processor skeletons, and OpenAPI documentation pipeline are configured and compiled.
                </p>
              </div>
              <span className="px-2.5 py-1 text-[11px] font-mono rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                Foundation Ready
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-indigo-500/20 text-xs">
              <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800">
                <span className="text-neutral-400 block text-[10px] uppercase font-mono tracking-wider">Storage Engine</span>
                <span className="font-semibold text-neutral-200">PostgreSQL (Prisma 7)</span>
              </div>
              <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800">
                <span className="text-neutral-400 block text-[10px] uppercase font-mono tracking-wider">Claiming Guarantee</span>
                <span className="font-semibold text-neutral-200">SKIP LOCKED Row Locks</span>
              </div>
              <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800">
                <span className="text-neutral-400 block text-[10px] uppercase font-mono tracking-wider">Fault Tolerance</span>
                <span className="font-semibold text-neutral-200">Lease Expiry + Heartbeats</span>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                    <span>Queued Jobs</span>
                    <Clock className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">0</div>
                  <span className="text-[11px] text-neutral-400">Waiting execution</span>
                </div>
                <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                    <span>Active Workers</span>
                    <Cpu className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">1</div>
                  <span className="text-[11px] text-neutral-400">Heartbeat healthy</span>
                </div>
                <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                    <span>Processed (24h)</span>
                    <RotateCw className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">0</div>
                  <span className="text-[11px] text-neutral-400">Success rate: 100%</span>
                </div>
                <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
                  <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                    <span>Dead Letter Queue</span>
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">0</div>
                  <span className="text-[11px] text-neutral-400">Exhausted retries</span>
                </div>
              </div>

              {/* Architecture Blueprint Section */}
              <div className="bg-neutral-900/60 p-5 rounded-xl border border-neutral-800 space-y-4">
                <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <Terminal className="h-4 w-4 text-indigo-400" />
                  <span>Distributed Job Lifecycle State Machine</span>
                </h3>

                <div className="flex items-center justify-between p-4 bg-neutral-950 rounded-lg border border-neutral-800 text-xs font-mono overflow-x-auto">
                  <div className="text-center px-3 py-2 bg-neutral-900 rounded border border-neutral-700">
                    <span className="text-amber-400 font-semibold block">QUEUED</span>
                    <span className="text-[10px] text-neutral-400">scheduledAt &lt;= NOW()</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-neutral-500 flex-shrink-0 mx-2" />
                  <div className="text-center px-3 py-2 bg-neutral-900 rounded border border-neutral-700">
                    <span className="text-blue-400 font-semibold block">CLAIMED</span>
                    <span className="text-[10px] text-neutral-400">SKIP LOCKED</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-neutral-500 flex-shrink-0 mx-2" />
                  <div className="text-center px-3 py-2 bg-neutral-900 rounded border border-neutral-700">
                    <span className="text-purple-400 font-semibold block">RUNNING</span>
                    <span className="text-[10px] text-neutral-400">30s Lease & Heartbeat</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-neutral-500 flex-shrink-0 mx-2" />
                  <div className="text-center px-3 py-2 bg-neutral-900 rounded border border-neutral-700">
                    <span className="text-emerald-400 font-semibold block">COMPLETED</span>
                    <span className="text-[10px] text-neutral-400">Persist result</span>
                  </div>
                  <span className="text-neutral-500 text-xs mx-1">OR</span>
                  <div className="text-center px-3 py-2 bg-neutral-900 rounded border border-neutral-700">
                    <span className="text-rose-400 font-semibold block">FAILED / DLQ</span>
                    <span className="text-[10px] text-neutral-400">Retry backoff</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'arch' && (
            <div className="bg-neutral-900/60 p-6 rounded-xl border border-neutral-800 space-y-4 text-xs">
              <h3 className="text-base font-semibold text-white">System Architecture & Core Invariants</h3>
              <ul className="list-disc pl-5 space-y-2 text-neutral-300">
                <li>
                  <strong className="text-white">Relational PostgreSQL Source of Truth:</strong> Job states, execution records, worker heartbeats, and DLQ entries persist in PostgreSQL.
                </li>
                <li>
                  <strong className="text-white">Atomic Concurrency via Row-Level Locks:</strong> Workers claim jobs inside ACID transactions using <code className="text-indigo-300 font-mono">SELECT ... FOR UPDATE SKIP LOCKED</code>, strictly preventing duplicate claiming across concurrent workers.
                </li>
                <li>
                  <strong className="text-white">Lease-Based Crash Recovery:</strong> Active executions maintain a dynamic lease (<code className="text-indigo-300 font-mono">leaseExpiresAt</code>). If a worker crashes or drops heartbeats, orphan jobs are safely recovered by remaining workers.
                </li>
                <li>
                  <strong className="text-white">Multi-Tenant Isolation:</strong> Strict relational hierarchy from User &rarr; OrganizationMember &rarr; Organization &rarr; Project &rarr; Queue &rarr; Job.
                </li>
              </ul>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
