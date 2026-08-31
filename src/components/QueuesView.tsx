import React, { useState } from 'react';
import {
  Layers,
  Play,
  Pause,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Settings2,
  RefreshCw,
} from 'lucide-react';
import { Queue } from '../types';
import { Api } from '../services/api';

interface QueuesViewProps {
  queues: Queue[];
  onRefresh: () => void;
}

export const QueuesView: React.FC<QueuesViewProps> = ({ queues, onRefresh }) => {
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newQueueName, setNewQueueName] = useState<string>('');
  const [newQueueDesc, setNewQueueDesc] = useState<string>('');
  const [newQueueConcurrency, setNewQueueConcurrency] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTogglePause = async (queue: Queue) => {
    try {
      if (queue.isPaused) {
        await Api.resumeQueue(queue.id);
      } else {
        await Api.pauseQueue(queue.id);
      }
      onRefresh();
    } catch (err: any) {
      alert(`Failed to toggle queue state: ${err.message}`);
    }
  };

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await Api.createQueue({
        name: newQueueName.trim(),
        description: newQueueDesc.trim() || undefined,
        concurrencyLimit: newQueueConcurrency,
      });
      setShowCreateModal(false);
      setNewQueueName('');
      setNewQueueDesc('');
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create queue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Queues</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {queues.length} Active Channels
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Separate workloads into dedicated queues to control task concurrency, rate limits, and pause/resume execution independently.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer self-start md:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Queue</span>
        </button>
      </div>

      {/* Grid of Queues */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queues.map((queue) => (
          <div
            key={queue.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">{queue.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {queue.description || 'General task processing queue'}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    queue.isPaused
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {queue.isPaused ? 'Paused' : 'Active'}
                </span>
              </div>

              {/* Concurrency & Config */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">
                    Concurrency Limit
                  </span>
                  <span className="font-bold text-slate-800 font-mono">
                    {queue.concurrencyLimit} workers
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">
                    Status
                  </span>
                  <span className="font-medium text-slate-700">
                    {queue.isPaused ? 'Halted' : 'Processing'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handleTogglePause(queue)}
                className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-xl border transition cursor-pointer font-medium ${
                  queue.isPaused
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                }`}
              >
                {queue.isPaused ? (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Resume Queue</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5 fill-current" />
                    <span>Pause Queue</span>
                  </>
                )}
              </button>

              <span className="text-[11px] font-mono text-slate-400">ID: {queue.id.slice(0, 8)}...</span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Queue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="font-bold text-base text-slate-900">Create New Queue</h2>
            <p className="text-xs text-slate-500">Add an isolated processing channel for your tasks.</p>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateQueue} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Queue Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. notifications, video-processing"
                  value={newQueueName}
                  onChange={(e) => setNewQueueName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Optional description of this queue"
                  value={newQueueDesc}
                  onChange={(e) => setNewQueueDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Max Concurrent Tasks
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newQueueConcurrency}
                  onChange={(e) => setNewQueueConcurrency(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
