import React from 'react';
import {
  Cpu,
  Heart,
  Play,
  Square,
  Zap,
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { WorkerInfo, WorkerDaemonStatus } from '../types';

interface WorkersViewProps {
  workers: WorkerInfo[];
  daemonStatus: WorkerDaemonStatus | null;
  onStartDaemon: () => void;
  onStopDaemon: () => void;
  onStepDaemon: () => void;
  onRefresh: () => void;
}

export const WorkersView: React.FC<WorkersViewProps> = ({
  workers,
  daemonStatus,
  onStartDaemon,
  onStopDaemon,
  onStepDaemon,
  onRefresh,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Worker Fleet</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                daemonStatus?.daemonRunning
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {daemonStatus?.daemonRunning ? 'Auto-Polling Active' : 'Polling Paused'}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Workers poll PostgreSQL queues atomically, obtain heartbeat leases to execute tasks safely, and recover stalled jobs if a crash occurs.
          </p>
        </div>

        {/* Fleet Control Actions */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {daemonStatus?.daemonRunning ? (
            <button
              onClick={onStopDaemon}
              className="flex items-center space-x-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 transition cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Pause Auto-Worker</span>
            </button>
          ) : (
            <button
              onClick={onStartDaemon}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Start Auto-Worker</span>
            </button>
          )}

          <button
            onClick={onStepDaemon}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl border border-slate-200 transition cursor-pointer"
            title="Execute exactly 1 pending job immediately"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Process 1 Job (Step)</span>
          </button>
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workers.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">No Registered Workers Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Start the worker daemon or submit a job to spawn a worker instance.
            </p>
          </div>
        ) : (
          workers.map((worker) => (
            <div
              key={worker.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="font-bold text-sm text-slate-900 font-mono">
                      {worker.workerId}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                    Host: {worker.hostname} {worker.processId ? `• PID: ${worker.processId}` : ''}
                  </span>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    worker.status === 'ONLINE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {worker.status}
                </span>
              </div>

              {/* Heartbeat & Metrics */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans">Total Executions:</span>
                  <span className="text-emerald-700 font-semibold">{worker._count?.executions ?? 0} jobs</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans">Heartbeats Count:</span>
                  <span className="text-slate-800 font-semibold">{worker._count?.heartbeats ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans">Last Heartbeat:</span>
                  <span className="text-slate-700 flex items-center space-x-1">
                    <Heart className="h-3 w-3 text-rose-500 fill-rose-500 animate-pulse" />
                    <span>{new Date(worker.lastHeartbeatAt).toLocaleTimeString()}</span>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
