import React from 'react';
import {
  Plus,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  Zap,
  Eye,
  TrendingUp,
  Activity,
  CheckCircle,
} from 'lucide-react';
import { Job, Queue, DashboardMetrics, WorkerDaemonStatus } from '../types';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  jobs: Job[];
  queues: Queue[];
  daemonStatus: WorkerDaemonStatus | null;
  onSelectJob: (job: Job) => void;
  onRetryJob: (id: string) => void;
  onOpenCreateModal: () => void;
  onQuickLaunch: (templateType: string) => void;
  onNavigateTab: (tab: string, filter?: string) => void;
  onStepDaemon: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  jobs,
  queues,
  daemonStatus,
  onSelectJob,
  onRetryJob,
  onOpenCreateModal,
  onQuickLaunch,
  onNavigateTab,
  onStepDaemon,
}) => {
  const recentJobs = jobs.slice(0, 7);

  const formatTaskName = (job: Job) => {
    return (
      (job.payload as any)?.taskName ||
      (job.payload as any)?.title ||
      (job.payload as any)?.type ||
      job.type ||
      'Background Task'
    );
  };

  const renderStatusBadge = (status: string, dlq?: any) => {
    if (dlq && dlq.status === 'UNRESOLVED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertOctagon className="h-3 w-3" />
          <span>In DLQ</span>
        </span>
      );
    }

    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            <span>Completed</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Activity className="h-3 w-3 animate-spin" />
            <span>Running</span>
          </span>
        );
      case 'QUEUED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3" />
            <span>Queued</span>
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <Clock className="h-3 w-3" />
            <span>Scheduled</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Overview Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tasks Overview</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              Live Engine
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Create background tasks, schedule when they should run, and monitor their real-time progress.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onStepDaemon}
            className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition cursor-pointer"
            title="Immediately trigger the worker to process 1 pending job"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Process 1 Job Now</span>
          </button>

          <button
            onClick={onOpenCreateModal}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-sm hover:shadow transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Job</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Jobs */}
        <button
          onClick={() => onNavigateTab('jobs')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow transition text-left cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Total Jobs</span>
            <Layers className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {metrics?.totalJobs ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">All submitted tasks</span>
        </button>

        {/* Queued / Waiting */}
        <button
          onClick={() => onNavigateTab('jobs', 'QUEUED')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-300 hover:shadow transition text-left cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Waiting in Queue</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 font-mono">
            {metrics?.queuedJobs ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Ready for worker</span>
        </button>

        {/* Running */}
        <button
          onClick={() => onNavigateTab('jobs', 'RUNNING')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow transition text-left cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Running Now</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 font-mono">
            {metrics?.runningJobs ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Active executions</span>
        </button>

        {/* Completed */}
        <button
          onClick={() => onNavigateTab('jobs', 'COMPLETED')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow transition text-left cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">
            {metrics?.completedJobs ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Successful runs</span>
        </button>

        {/* Failed / Retrying */}
        <button
          onClick={() => onNavigateTab('failed')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-rose-300 hover:shadow transition text-left cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Failed / Issues</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 font-mono">
            {metrics?.failedJobs ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {(metrics?.dlqJobs ?? 0) > 0 ? `${metrics?.dlqJobs} in DLQ` : 'Needs attention'}
          </span>
        </button>

        {/* Online Workers */}
        <button
          onClick={() => onNavigateTab('workers')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow transition text-left cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Active Workers</span>
            <Cpu className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {metrics?.activeWorkers ?? 0}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {daemonStatus?.daemonRunning ? 'Auto-polling online' : 'Daemon paused'}
          </span>
        </button>
      </div>

      {/* Interactive Workflow Banner: How It Works */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
              How Job Execution Works
            </h2>
          </div>
          <span className="text-xs text-slate-400">Click any step to explore</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Step 1 */}
          <div
            onClick={onOpenCreateModal}
            className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl p-3.5 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                Step 1
              </span>
              <span className="text-[11px] font-medium text-indigo-200 bg-indigo-500/30 px-2 py-0.5 rounded-full">
                + Create
              </span>
            </div>
            <h3 className="font-semibold text-xs text-white">Create a Task</h3>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Define your job, choose a queue, and decide if it runs now or later.
            </p>
          </div>

          {/* Step 2 */}
          <div
            onClick={() => onNavigateTab('jobs', 'QUEUED')}
            className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl p-3.5 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Step 2
              </span>
              <span className="text-[11px] font-medium text-amber-200 bg-amber-500/30 px-2 py-0.5 rounded-full">
                {metrics?.queuedJobs ?? 0} Queued
              </span>
            </div>
            <h3 className="font-semibold text-xs text-white">Placed in Queue</h3>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Jobs wait safely in PostgreSQL with atomic priority ordering.
            </p>
          </div>

          {/* Step 3 */}
          <div
            onClick={() => onNavigateTab('jobs', 'RUNNING')}
            className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl p-3.5 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                Step 3
              </span>
              <span className="text-[11px] font-medium text-blue-200 bg-blue-500/30 px-2 py-0.5 rounded-full">
                {metrics?.runningJobs ?? 0} Running
              </span>
            </div>
            <h3 className="font-semibold text-xs text-white">Worker Executes</h3>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              An active worker claims the job atomically with a heartbeat lease.
            </p>
          </div>

          {/* Step 4 */}
          <div
            onClick={() => onNavigateTab('jobs', 'COMPLETED')}
            className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl p-3.5 transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Step 4
              </span>
              <span className="text-[11px] font-medium text-emerald-200 bg-emerald-500/30 px-2 py-0.5 rounded-full">
                {metrics?.completedJobs ?? 0} Succeeded
              </span>
            </div>
            <h3 className="font-semibold text-xs text-white">Result or Retry</h3>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Results are stored. If a task fails, it automatically retries with backoff!
            </p>
          </div>
        </div>
      </div>

      {/* Quick Launch Demo Tasks */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Try a Sample Task (1-Click Test)</h2>
            <p className="text-xs text-slate-500">
              Instantly submit sample tasks to test the scheduling and recovery engine.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Quick Task 1: Instant Success */}
          <button
            onClick={() => onQuickLaunch('echo')}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-50/60 hover:border-indigo-200 text-left transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center space-x-2 text-indigo-600 text-xs font-semibold mb-1">
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Instant Task</span>
              </div>
              <p className="text-xs font-medium text-slate-800">Send Welcome Email</p>
              <p className="text-[11px] text-slate-500 mt-1">Runs immediately and finishes in milliseconds.</p>
            </div>
            <span className="text-[11px] text-indigo-600 font-medium mt-3 flex items-center space-x-1 group-hover:translate-x-0.5 transition">
              <span>Run Task</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </button>

          {/* Quick Task 2: Auto-Retry Demo */}
          <button
            onClick={() => onQuickLaunch('fail-once')}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-orange-50/60 hover:border-orange-200 text-left transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center space-x-2 text-orange-600 text-xs font-semibold mb-1">
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Auto-Retry Demo</span>
              </div>
              <p className="text-xs font-medium text-slate-800">Sync External API</p>
              <p className="text-[11px] text-slate-500 mt-1">Fails on attempt 1, automatically recovers on #2.</p>
            </div>
            <span className="text-[11px] text-orange-600 font-medium mt-3 flex items-center space-x-1 group-hover:translate-x-0.5 transition">
              <span>Run Task</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </button>

          {/* Quick Task 3: Error & DLQ Quarantine */}
          <button
            onClick={() => onQuickLaunch('fatal-dlq')}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-rose-50/60 hover:border-rose-200 text-left transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center space-x-2 text-rose-600 text-xs font-semibold mb-1">
                <AlertOctagon className="h-3.5 w-3.5" />
                <span>Error & DLQ Demo</span>
              </div>
              <p className="text-xs font-medium text-slate-800">Payment Gateway Error</p>
              <p className="text-[11px] text-slate-500 mt-1">Exhausts 3 retries, moves to Failed Jobs to test recovery.</p>
            </div>
            <span className="text-[11px] text-rose-600 font-medium mt-3 flex items-center space-x-1 group-hover:translate-x-0.5 transition">
              <span>Run Task</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </button>

          {/* Quick Task 4: Long-running 4s task */}
          <button
            onClick={() => onQuickLaunch('sleep')}
            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/60 hover:border-blue-200 text-left transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center space-x-2 text-blue-600 text-xs font-semibold mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Long Task (4s)</span>
              </div>
              <p className="text-xs font-medium text-slate-800">Transcode Video</p>
              <p className="text-[11px] text-slate-500 mt-1">Runs for 4 seconds to watch worker lease in action.</p>
            </div>
            <span className="text-[11px] text-blue-600 font-medium mt-3 flex items-center space-x-1 group-hover:translate-x-0.5 transition">
              <span>Run Task</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </button>
        </div>
      </div>

      {/* Recent Jobs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Tasks</h2>
            <p className="text-xs text-slate-500">The latest jobs submitted to the scheduler</p>
          </div>

          <button
            onClick={() => onNavigateTab('jobs')}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center space-x-1"
          >
            <span>View All Jobs</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-mono text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-5">Task Name & ID</th>
                <th className="py-3 px-5">Queue</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Worker</th>
                <th className="py-3 px-5">Attempts</th>
                <th className="py-3 px-5">Submitted</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {recentJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Layers className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">No jobs created yet</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click <strong>Create New Job</strong> or select a quick template above.
                    </p>
                  </td>
                </tr>
              ) : (
                recentJobs.map((job) => {
                  const taskTitle = formatTaskName(job);
                  return (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className="hover:bg-slate-50/80 transition cursor-pointer group"
                    >
                      {/* Name & ID */}
                      <td className="py-3 px-5">
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition">
                          {taskTitle}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 truncate max-w-[180px]">
                          {job.id}
                        </div>
                      </td>

                      {/* Queue */}
                      <td className="py-3 px-5">
                        <span className="font-medium text-slate-700">
                          {job.queue?.name || job.queueId}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-5">
                        {renderStatusBadge(job.status, job.deadLetterJob)}
                      </td>

                      {/* Worker */}
                      <td className="py-3 px-5">
                        {job.lockedByWorker ? (
                          <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {job.lockedByWorker.workerId}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Queued</span>
                        )}
                      </td>

                      {/* Attempts */}
                      <td className="py-3 px-5 font-mono text-[11px] text-slate-600">
                        {job.attemptCount} / {job.maxAttempts}
                      </td>

                      {/* Time */}
                      <td className="py-3 px-5 text-slate-500 text-[11px]">
                        {new Date(job.createdAt).toLocaleTimeString()}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-5 text-right space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onSelectJob(job)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
                          <button
                            onClick={() => onRetryJob(job.id)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-700 rounded-lg hover:bg-indigo-50 transition"
                            title="Retry Task"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
