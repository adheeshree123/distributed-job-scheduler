import React from 'react';
import {
  Settings2,
  RefreshCw,
  Clock,
  ShieldCheck,
  Zap,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';

interface SettingsViewProps {
  refreshInterval: number;
  setRefreshInterval: (ms: number) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  refreshInterval,
  setRefreshInterval,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Preferences & Engine Settings</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Client Controls
          </span>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          Customize UI auto-refresh intervals and review scheduler runtime parameters.
        </p>
      </div>

      {/* Settings Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Polling Interval */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-900">Dashboard Live Polling Interval</h2>
          </div>
          <p className="text-xs text-slate-500">
            Control how frequently the dashboard queries PostgreSQL for newly claimed and completed tasks.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {[
              { label: 'Live (1.5s)', val: 1500 },
              { label: 'Standard (3s)', val: 3000 },
              { label: 'Slow (6s)', val: 6000 },
              { label: 'Manual Only', val: 0 },
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => setRefreshInterval(opt.val)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  refreshInterval === opt.val
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick User Guide */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            <h2 className="font-bold text-sm text-slate-900">Beginner Quick Start Guide</h2>
          </div>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-start space-x-2">
              <span className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                1
              </span>
              <span>Click <strong>+ Create Job</strong> to submit a task.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                2
              </span>
              <span>The background worker claims it and executes the payload.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                3
              </span>
              <span>If a job fails, it automatically retries with backoff, or moves to Failed Jobs for 1-click retry.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
