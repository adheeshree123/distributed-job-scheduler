import React from 'react';
import {
  Play,
  Square,
  Zap,
  Plus,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { WorkerDaemonStatus } from '../types';

interface NavbarProps {
  daemonStatus: WorkerDaemonStatus | null;
  onStartDaemon: () => void;
  onStopDaemon: () => void;
  onStepDaemon: () => void;
  onOpenCreateModal: () => void;
  refreshInterval: number;
  setRefreshInterval: (ms: number) => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  daemonStatus,
  onStartDaemon,
  onStopDaemon,
  onStepDaemon,
  onOpenCreateModal,
  refreshInterval,
  setRefreshInterval,
  onManualRefresh,
  isRefreshing,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
          <Clock className="h-5 w-5 stroke-[2.2]" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-base tracking-tight text-slate-900">Job Scheduler</h1>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Distributed
            </span>
          </div>
          <p className="text-xs text-slate-500">Manage your background tasks</p>
        </div>
      </div>

      {/* Center / Right Control Hub */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Worker Engine Status & Controls */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 space-x-1.5">
          <div className="flex items-center space-x-2 px-2.5 py-1 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                daemonStatus?.daemonRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="text-slate-700 text-xs font-medium">
              Worker:{' '}
              <strong className={daemonStatus?.daemonRunning ? 'text-emerald-700 font-semibold' : 'text-slate-500 font-normal'}>
                {daemonStatus?.daemonRunning ? 'Online' : 'Stopped'}
              </strong>
            </span>
          </div>

          {daemonStatus?.daemonRunning ? (
            <button
              onClick={onStopDaemon}
              className="flex items-center space-x-1 text-xs px-2.5 py-1 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-lg border border-slate-200 transition cursor-pointer"
              title="Pause worker loop"
            >
              <Square className="h-3 w-3 fill-current text-rose-500" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={onStartDaemon}
              className="flex items-center space-x-1 text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs cursor-pointer"
              title="Start auto-polling worker"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Start Worker</span>
            </button>
          )}

          <button
            onClick={onStepDaemon}
            className="flex items-center space-x-1 text-xs px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Claim and execute 1 job on-demand"
          >
            <Zap className="h-3 w-3 text-amber-500" />
            <span>Step 1 Job</span>
          </button>
        </div>

        {/* Auto Refresh Switcher */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 space-x-1">
          <button
            onClick={onManualRefresh}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            title="Refresh now"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="bg-transparent text-xs text-slate-700 py-1 px-1.5 focus:outline-none cursor-pointer font-medium"
          >
            <option value={1500}>Live (1.5s)</option>
            <option value={3000}>3s refresh</option>
            <option value={6000}>6s refresh</option>
            <option value={0}>Manual only</option>
          </select>
        </div>

        {/* Prominent Create Job Button */}
        <button
          id="btn-create-job-primary"
          onClick={onOpenCreateModal}
          className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-xs hover:shadow transition cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Create Job</span>
        </button>
      </div>
    </header>
  );
};
