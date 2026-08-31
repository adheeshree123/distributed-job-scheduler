import React from 'react';
import {
  Layers,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Cpu,
} from 'lucide-react';
import { DashboardMetrics } from '../types';

interface MetricsCardsProps {
  metrics: DashboardMetrics | null;
  onFilterStatus?: (status: string) => void;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ metrics, onFilterStatus }) => {
  const cards = [
    {
      label: 'Total Jobs',
      value: metrics?.totalJobs ?? 0,
      icon: Layers,
      color: 'text-indigo-400',
      bg: 'from-indigo-500/10 to-transparent',
      borderColor: 'border-indigo-500/20',
      filter: '',
    },
    {
      label: 'Queued / Ready',
      value: metrics?.queuedJobs ?? 0,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'from-amber-500/10 to-transparent',
      borderColor: 'border-amber-500/20',
      filter: 'QUEUED',
    },
    {
      label: 'Active Running',
      value: metrics?.runningJobs ?? 0,
      icon: PlayCircle,
      color: 'text-blue-400',
      bg: 'from-blue-500/10 to-transparent',
      borderColor: 'border-blue-500/20',
      filter: 'RUNNING',
    },
    {
      label: 'Completed',
      value: metrics?.completedJobs ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'from-emerald-500/10 to-transparent',
      borderColor: 'border-emerald-500/20',
      filter: 'COMPLETED',
    },
    {
      label: 'Failed / Retrying',
      value: metrics?.failedJobs ?? 0,
      icon: AlertTriangle,
      color: 'text-orange-400',
      bg: 'from-orange-500/10 to-transparent',
      borderColor: 'border-orange-500/20',
      filter: 'FAILED',
    },
    {
      label: 'Dead Letter Queue',
      value: metrics?.dlqJobs ?? 0,
      icon: AlertOctagon,
      color: 'text-rose-400',
      bg: 'from-rose-500/10 to-transparent',
      borderColor: 'border-rose-500/20',
      filter: 'DLQ',
    },
    {
      label: 'Online Workers',
      value: metrics?.activeWorkers ?? 0,
      icon: Cpu,
      color: 'text-cyan-400',
      bg: 'from-cyan-500/10 to-transparent',
      borderColor: 'border-cyan-500/20',
      filter: 'WORKERS',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.label}
            onClick={() => onFilterStatus && card.filter && onFilterStatus(card.filter)}
            className={`flex flex-col text-left p-3.5 rounded-xl border bg-gradient-to-b ${card.bg} ${card.borderColor} bg-neutral-900/60 hover:bg-neutral-800/80 transition`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[11px] font-medium text-neutral-400 truncate">{card.label}</span>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <span className="text-xl font-bold font-mono text-white tracking-tight">
              {card.value.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
};
