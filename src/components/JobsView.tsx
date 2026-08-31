import React from 'react';
import {
  Search,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Eye,
  Plus,
  Zap,
  Cpu,
  Layers,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { Job, Queue, JobStatus } from '../types';

interface JobsViewProps {
  jobs: Job[];
  queues: Queue[];
  totalJobs: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  queueFilter: string;
  onQueueFilterChange: (queueId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSelectJob: (job: Job) => void;
  onRetryJob: (id: string) => void;
  onOpenCreateModal: () => void;
  onStepDaemon: () => void;
  isLoading: boolean;
}

export const JobsView: React.FC<JobsViewProps> = ({
  jobs,
  queues,
  totalJobs,
  currentPage,
  totalPages,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  queueFilter,
  onQueueFilterChange,
  searchQuery,
  onSearchQueryChange,
  onSelectJob,
  onRetryJob,
  onOpenCreateModal,
  onStepDaemon,
  isLoading,
}) => {
  const statusOptions: { label: string; value: string }[] = [
    { label: 'All Jobs', value: '' },
    { label: 'Queued', value: 'QUEUED' },
    { label: 'Running', value: 'RUNNING' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Failed', value: 'FAILED' },
    { label: 'Scheduled', value: 'SCHEDULED' },
  ];

  const formatTaskName = (job: Job) => {
    return (
      (job.payload as any)?.taskName ||
      (job.payload as any)?.title ||
      (job.payload as any)?.type ||
      job.type ||
      'Background Task'
    );
  };

  const renderStatusBadge = (status: JobStatus, deadLetterJob?: any) => {
    if (deadLetterJob && deadLetterJob.status === 'UNRESOLVED') {
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
      case 'CLAIMED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Cpu className="h-3 w-3" />
            <span>Claimed</span>
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
            <Calendar className="h-3 w-3" />
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
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center flex-1 min-w-[240px] space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by task name, Job ID, or queue..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Queue Filter */}
          <select
            value={queueFilter}
            onChange={(e) => onQueueFilterChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
          >
            <option value="">All Queues</option>
            {queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onStatusFilterChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                statusFilter === opt.value
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Jobs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-mono text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Task Name & Job ID</th>
                <th className="py-3.5 px-5">Queue</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Assigned Worker</th>
                <th className="py-3.5 px-5">Attempts / Retries</th>
                <th className="py-3.5 px-5">Timing</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <Layers className="h-10 w-10 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-700">No jobs found</p>
                      <p className="text-xs text-slate-500">
                        {statusFilter || searchQuery || queueFilter
                          ? 'Try clearing or changing your filters to see more tasks.'
                          : 'Get started by creating your first background job.'}
                      </p>
                      <button
                        onClick={onOpenCreateModal}
                        className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer shadow-xs"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Create Job</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const taskTitle = formatTaskName(job);

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className="hover:bg-slate-50/80 transition cursor-pointer group"
                    >
                      {/* Job Name & ID */}
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition">
                          {taskTitle}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                          {job.id}
                        </div>
                      </td>

                      {/* Queue */}
                      <td className="py-3.5 px-5">
                        <span className="font-medium text-slate-700">
                          {job.queue?.name || job.queueId}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Priority: {job.priority}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-5">
                        {renderStatusBadge(job.status, job.deadLetterJob)}
                      </td>

                      {/* Assigned Worker */}
                      <td className="py-3.5 px-5">
                        {job.lockedByWorker ? (
                          <div className="flex items-center space-x-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="font-mono text-slate-700 text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                              {job.lockedByWorker.workerId}
                            </span>
                          </div>
                        ) : job.lockedByWorkerId ? (
                          <span className="font-mono text-slate-600 text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                            {job.lockedByWorkerId}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">In Queue</span>
                        )}
                      </td>

                      {/* Attempts / Retries */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden w-16">
                            <div
                              className={`h-full rounded-full ${
                                job.status === 'COMPLETED'
                                  ? 'bg-emerald-500'
                                  : job.status === 'FAILED'
                                  ? 'bg-rose-500'
                                  : 'bg-indigo-600'
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (job.attemptCount / Math.max(1, job.maxAttempts)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-600 font-medium">
                            {job.attemptCount}/{job.maxAttempts}
                          </span>
                        </div>
                      </td>

                      {/* Timing */}
                      <td className="py-3.5 px-5 text-slate-500 text-[11px]">
                        <div>{new Date(job.createdAt).toLocaleTimeString()}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-5 text-right space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onSelectJob(job)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                          title="Inspect Job"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
                          <button
                            onClick={() => onRetryJob(job.id)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-700 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                            title="Retry Job"
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

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {jobs.length} of {totalJobs} total jobs
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
