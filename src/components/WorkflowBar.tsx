import React from 'react';
import {
  PlusCircle,
  Clock,
  Key,
  PlayCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertOctagon,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { DashboardMetrics } from '../types';

interface WorkflowBarProps {
  metrics: DashboardMetrics | null;
  selectedStage: string | null;
  onSelectStage: (stage: string | null) => void;
  onOpenCreateModal: () => void;
}

export const WorkflowBar: React.FC<WorkflowBarProps> = ({
  metrics,
  selectedStage,
  onSelectStage,
  onOpenCreateModal,
}) => {
  const stages = [
    {
      id: 'create',
      label: '1. Create Job',
      icon: PlusCircle,
      count: '+ New',
      color: 'text-indigo-400 border-indigo-500/30 bg-indigo-950/20',
      action: onOpenCreateModal,
      hint: 'Define payload, queue, priority & max retries',
    },
    {
      id: 'QUEUED',
      label: '2. Queued in DB',
      icon: Clock,
      count: metrics?.queuedJobs ?? 0,
      color: 'text-amber-400 border-amber-500/30 bg-amber-950/20',
      filterStatus: 'QUEUED',
      hint: 'Ready for worker pickup',
    },
    {
      id: 'CLAIMED',
      label: '3. Worker Claims',
      icon: Key,
      count: 'SKIP LOCKED',
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20',
      filterStatus: 'CLAIMED',
      hint: 'Atomic transaction & lease lock',
    },
    {
      id: 'RUNNING',
      label: '4. Running',
      icon: PlayCircle,
      count: metrics?.runningJobs ?? 0,
      color: 'text-blue-400 border-blue-500/30 bg-blue-950/20',
      filterStatus: 'RUNNING',
      hint: 'Heartbeat lease renewal active',
    },
    {
      id: 'COMPLETED',
      label: '5. Completed',
      icon: CheckCircle2,
      count: metrics?.completedJobs ?? 0,
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
      filterStatus: 'COMPLETED',
      hint: 'Result persisted to database',
    },
    {
      id: 'RETRY',
      label: '6. Retry Backoff',
      icon: RotateCcw,
      count: metrics?.failedJobs ?? 0,
      color: 'text-orange-400 border-orange-500/30 bg-orange-950/20',
      filterStatus: 'FAILED',
      hint: 'Exponential / linear delay recalculation',
    },
    {
      id: 'DLQ',
      label: '7. Dead Letter Queue',
      icon: AlertOctagon,
      count: metrics?.dlqJobs ?? 0,
      color: 'text-rose-400 border-rose-500/30 bg-rose-950/20',
      filterStatus: 'DLQ',
      hint: 'Quarantined after max retries exhausted',
    },
  ];

  return (
    <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-neutral-200 tracking-wide uppercase font-mono">
            Scheduler Lifecycle Pipeline
          </span>
          <span className="text-[11px] text-neutral-400">
            (Click any stage to filter jobs or test actions)
          </span>
        </div>
        {selectedStage && (
          <button
            onClick={() => onSelectStage(null)}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-mono underline"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Horizontal Stepper Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isSelected = selectedStage === (stage.filterStatus || stage.id);

          return (
            <button
              key={stage.id}
              onClick={() => {
                if (stage.action) {
                  stage.action();
                } else if (stage.filterStatus) {
                  onSelectStage(isSelected ? null : stage.filterStatus);
                }
              }}
              className={`flex flex-col text-left p-3 rounded-xl border transition group cursor-pointer relative ${
                isSelected
                  ? 'bg-neutral-800 border-indigo-500 ring-1 ring-indigo-500'
                  : 'bg-neutral-950/60 border-neutral-800 hover:bg-neutral-800/60 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className={`p-1.5 rounded-lg border ${stage.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-mono font-bold text-neutral-200 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                  {stage.count}
                </span>
              </div>

              <div className="font-semibold text-xs text-neutral-200 group-hover:text-white truncate">
                {stage.label}
              </div>
              <div className="text-[10px] text-neutral-400 leading-tight mt-0.5 line-clamp-1">
                {stage.hint}
              </div>

              {/* Connecting Indicator for larger screens */}
              {idx < stages.length - 1 && (
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-neutral-600 pointer-events-none">
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
