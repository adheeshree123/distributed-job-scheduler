import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Clock,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Check,
  Terminal,
  Activity,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Code,
} from 'lucide-react';
import { Job, JobExecution, JobLog } from '../types';
import { Api } from '../services/api';

interface JobDetailDrawerProps {
  job: Job | null;
  onClose: () => void;
  onRetry: (id: string) => void;
}

export const JobDetailDrawer: React.FC<JobDetailDrawerProps> = ({ job, onClose, onRetry }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'executions' | 'logs' | 'technical'>('overview');
  const [executions, setExecutions] = useState<JobExecution[]>([]);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  useEffect(() => {
    if (job) {
      setLoadingDetails(true);
      Promise.all([Api.getJobExecutions(job.id), Api.getJobLogs(job.id)])
        .then(([execData, logData]) => {
          setExecutions(execData || []);
          setLogs(logData || []);
          setLoadingDetails(false);
        })
        .catch((err) => {
          console.error('Failed to load job details:', err);
          setLoadingDetails(false);
        });
    }
  }, [job]);

  if (!job) return null;

  const handleCopy = (text: string, type: 'id' | 'payload') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }
  };

  const taskTitle =
    (job.payload as any)?.taskName ||
    (job.payload as any)?.title ||
    (job.payload as any)?.type ||
    job.type ||
    'Background Task';

  const getStatusBadge = (status: string, deadLetterJob?: any) => {
    if (deadLetterJob && deadLetterJob.status === 'UNRESOLVED') {
      return (
        <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertOctagon className="h-3.5 w-3.5" />
          <span>In Dead Letter Queue</span>
        </span>
      );
    }

    switch (status) {
      case 'COMPLETED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Completed Successfully</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Activity className="h-3.5 w-3.5 animate-spin" />
            <span>Currently Running</span>
          </span>
        );
      case 'CLAIMED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Cpu className="h-3.5 w-3.5" />
            <span>Claimed by Worker</span>
          </span>
        );
      case 'QUEUED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3.5 w-3.5" />
            <span>Queued & Waiting</span>
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Calendar className="h-3.5 w-3.5" />
            <span>Scheduled</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Execution Failed</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col font-sans">
      {/* Drawer Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            {getStatusBadge(job.status, job.deadLetterJob)}
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
              {job.type}
            </span>
          </div>

          <h2 className="text-lg font-bold text-slate-900">{taskTitle}</h2>

          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className="font-mono">{job.id}</span>
            <button
              onClick={() => handleCopy(job.id, 'id')}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-200 transition cursor-pointer"
              title="Copy Job ID"
            >
              {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <span>• Queue: <strong className="text-slate-700">{job.queue?.name || job.queueId}</strong></span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Visual Execution Timeline */}
      <div className="px-6 py-4 bg-slate-50/40 border-b border-slate-200">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
          Progress Timeline
        </div>
        <div className="flex items-center justify-between text-xs font-medium">
          {/* Step 1: Created */}
          <div className="flex flex-col items-center text-center">
            <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs mb-1">
              ✓
            </div>
            <span className="text-slate-700 text-[11px]">Submitted</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <div className="h-0.5 flex-1 bg-emerald-200 mx-2" />

          {/* Step 2: Queued */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                job.status === 'QUEUED' || job.status === 'SCHEDULED'
                  ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400 animate-pulse'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              ✓
            </div>
            <span className="text-slate-700 text-[11px]">Queued</span>
            <span className="text-[10px] text-slate-400 font-mono">Ready</span>
          </div>

          <div
            className={`h-0.5 flex-1 mx-2 ${
              job.status === 'QUEUED' || job.status === 'SCHEDULED'
                ? 'bg-slate-200'
                : 'bg-emerald-200'
            }`}
          />

          {/* Step 3: Worker Running */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                job.status === 'RUNNING' || job.status === 'CLAIMED'
                  ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400 animate-pulse'
                  : job.status === 'COMPLETED' || job.status === 'FAILED'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {job.status === 'RUNNING' || job.status === 'CLAIMED' ? '⚙' : '✓'}
            </div>
            <span className="text-slate-700 text-[11px]">Running</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {job.lockedByWorker?.workerId || (job.status === 'RUNNING' ? 'Active' : '-')}
            </span>
          </div>

          <div
            className={`h-0.5 flex-1 mx-2 ${
              job.status === 'COMPLETED' || job.status === 'FAILED'
                ? 'bg-emerald-200'
                : 'bg-slate-200'
            }`}
          />

          {/* Step 4: Final Outcome */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                job.status === 'COMPLETED'
                  ? 'bg-emerald-600 text-white'
                  : job.status === 'FAILED'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {job.status === 'COMPLETED' ? '✓' : job.status === 'FAILED' ? '✕' : '•'}
            </div>
            <span className="text-slate-700 text-[11px]">
              {job.status === 'COMPLETED'
                ? 'Finished'
                : job.status === 'FAILED'
                ? 'Failed'
                : 'Outcome'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {job.status === 'COMPLETED'
                ? 'Success'
                : job.status === 'FAILED'
                ? 'Check error'
                : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6 gap-3 pt-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Task Overview & Results
        </button>

        <button
          onClick={() => setActiveTab('executions')}
          className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
            activeTab === 'executions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Attempts & Retries</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {job.attemptCount}/{job.maxAttempts}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
            activeTab === 'logs'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>Execution Logs ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('technical')}
          className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'technical'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Technical Details
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* TAB 1: OVERVIEW & RESULTS */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Success Result Box */}
            {job.result && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-emerald-800 font-semibold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Execution Succeeded - Output</span>
                </div>
                <pre className="p-3 bg-white border border-emerald-200 rounded-xl text-xs font-mono text-emerald-900 overflow-x-auto">
                  {JSON.stringify(job.result, null, 2)}
                </pre>
              </div>
            )}

            {/* Error Message Box */}
            {job.errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                <div className="flex items-center space-x-2 text-rose-800 font-semibold text-xs uppercase tracking-wider">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>Failure Explanation / Error Message</span>
                </div>
                <div className="p-3 bg-white border border-rose-200 rounded-xl text-xs font-mono text-rose-800 whitespace-pre-wrap leading-relaxed">
                  {job.errorMessage}
                </div>
              </div>
            )}

            {/* Task Parameters Payload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Task Parameters (Payload)
                </span>
                <button
                  onClick={() => handleCopy(JSON.stringify(job.payload, null, 2), 'payload')}
                  className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {copiedPayload ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 overflow-x-auto leading-relaxed">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </div>

            {/* Basic Info Cards */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Priority</span>
                <span className="font-semibold text-slate-800">{job.priority}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Submitted At</span>
                <span className="text-slate-800 font-medium">{new Date(job.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ATTEMPTS & RETRIES */}
        {activeTab === 'executions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Execution Attempts ({executions.length} of {job.maxAttempts} allowed)
              </span>
              {job.retryPolicy && (
                <span className="text-[11px] font-mono text-indigo-600 font-medium">
                  Policy: {job.retryPolicy.name} ({job.retryPolicy.strategy})
                </span>
              )}
            </div>

            {executions.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                No executions recorded yet. The task is queued or scheduled.
              </div>
            ) : (
              <div className="space-y-3">
                {executions.map((exec) => (
                  <div
                    key={exec.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold font-mono text-slate-900 px-2 py-0.5 rounded bg-slate-200">
                          Attempt #{exec.attemptNumber}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            exec.status === 'COMPLETED'
                              ? 'text-emerald-700'
                              : exec.status === 'FAILED'
                              ? 'text-rose-700'
                              : 'text-blue-700'
                          }`}
                        >
                          {exec.status}
                        </span>
                      </div>
                      {exec.durationMs !== undefined && exec.durationMs !== null && (
                        <span className="text-xs font-mono text-slate-500">{exec.durationMs} ms</span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                      <div>
                        <span className="text-slate-400">Worker:</span>{' '}
                        <span className="font-mono font-medium text-slate-800">
                          {exec.worker?.workerId || exec.workerId}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Started:</span>{' '}
                        <span>{new Date(exec.startedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {exec.error && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-mono text-rose-800 leading-relaxed">
                        {exec.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
              Structured Logs
            </span>
            {logs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                No logs recorded yet.
              </div>
            ) : (
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 font-mono text-xs space-y-2 max-h-96 overflow-y-auto text-slate-200">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start space-x-2 text-[11px] leading-relaxed">
                    <span className="text-slate-500 flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`font-semibold px-1 rounded text-[10px] uppercase ${
                        log.level === 'ERROR'
                          ? 'bg-rose-500/30 text-rose-300'
                          : log.level === 'WARN'
                          ? 'bg-amber-500/30 text-amber-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-slate-100">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TECHNICAL DETAILS */}
        {activeTab === 'technical' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Assigned Worker</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {job.lockedByWorker?.workerId || job.lockedByWorkerId || 'None (in queue)'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Row Version</span>
                <span className="font-mono text-slate-800 font-semibold">v{job.version}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Scheduled For</span>
                <span className="text-slate-800">{new Date(job.scheduledAt).toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Heartbeat Lease TTL</span>
                <span className="text-slate-800">
                  {job.leaseExpiresAt ? new Date(job.leaseExpiresAt).toLocaleTimeString() : 'N/A'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Idempotency Key</span>
                <span className="font-mono text-slate-800 truncate block">
                  {job.idempotencyKey || 'None'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Footer Actions */}
      <div className="p-6 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <button
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition cursor-pointer"
        >
          Close
        </button>

        {(job.status === 'FAILED' || job.status === 'CANCELLED' || job.deadLetterJob) && (
          <button
            onClick={() => onRetry(job.id)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Retry Task Now</span>
          </button>
        )}
      </div>
    </div>
  );
};
