import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  RotateCcw,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DeadLetterJob } from '../types';
import { Api } from '../services/api';

interface DLQViewProps {
  onRetrySuccess?: () => void;
}

export const DLQView: React.FC<DLQViewProps> = ({ onRetrySuccess }) => {
  const [dlqItems, setDlqItems] = useState<DeadLetterJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchDLQ = () => {
    setLoading(true);
    Api.listDLQ()
      .then((res) => {
        setDlqItems(res.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch DLQ:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDLQ();
  }, []);

  const handleRetry = async (id: string) => {
    try {
      await Api.retryDLQ(id);
      setActionMessage('Job successfully re-queued for execution!');
      fetchDLQ();
      if (onRetrySuccess) onRetrySuccess();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage(`Error retrying DLQ item: ${err.message}`);
    }
  };

  const handleDiscard = async (id: string) => {
    try {
      await Api.discardDLQ(id);
      setActionMessage('Job marked as DISCARDED.');
      fetchDLQ();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setActionMessage(`Error discarding DLQ item: ${err.message}`);
    }
  };

  const unresolvedCount = dlqItems.filter((i) => i.status === 'UNRESOLVED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Failed Jobs & Recovery</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                unresolvedCount > 0
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {unresolvedCount > 0 ? `${unresolvedCount} Tasks Need Attention` : 'All Clean'}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            When a task encounters an unrecoverable error or exhausts all retry attempts, it is safely quarantined here so you can review the error and replay it with one click.
          </p>
        </div>

        <button
          onClick={fetchDLQ}
          className="flex items-center space-x-1.5 p-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition cursor-pointer text-xs font-medium self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-800 font-medium flex items-center justify-between shadow-xs">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {dlqItems.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-base text-slate-900">No Failed Tasks in Quarantine</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All background jobs are running smoothly. If a job exhausts its maximum retries, it will appear here for 1-click replay.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {dlqItems.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-slate-300 shadow-sm transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-sm text-slate-900 block">
                      {(item.job?.payload as any)?.taskName || 'Quarantined Task'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      ID: {item.jobId}
                    </span>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Queue: <strong className="text-slate-700">{item.queue?.name || item.queueId}</strong>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      item.status === 'UNRESOLVED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : item.status === 'RETRIED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                {/* Failure Reason */}
                <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs font-mono text-rose-900 leading-relaxed">
                  <span className="text-[10px] text-rose-600 uppercase block font-sans font-semibold mb-1">
                    Failure Cause:
                  </span>
                  {item.reason}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400">Attempts Made:</span>{' '}
                    <span className="font-mono text-slate-800 font-semibold">{item.attemptsCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Failed At:</span>{' '}
                    <span>{new Date(item.failedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {item.status === 'UNRESOLVED' && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleDiscard(item.id)}
                    className="flex items-center space-x-1 text-xs px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Discard</span>
                  </button>

                  <button
                    onClick={() => handleRetry(item.id)}
                    className="flex items-center space-x-1.5 text-xs px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition font-semibold cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Retry Task Now</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
