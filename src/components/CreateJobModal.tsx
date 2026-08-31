import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Play,
  Clock,
  RotateCcw,
  AlertOctagon,
  Cpu,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  Code,
  Calendar,
  Layers,
} from 'lucide-react';
import { Queue, RetryPolicy, Job } from '../types';
import { Api } from '../services/api';

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  queues: Queue[];
  retryPolicies: RetryPolicy[];
  onJobCreated: (newJob: Job) => void;
}

export const CreateJobModal: React.FC<CreateJobModalProps> = ({
  isOpen,
  onClose,
  queues,
  retryPolicies,
  onJobCreated,
}) => {
  // Simplified Primary Fields
  const [jobTitle, setJobTitle] = useState<string>('Send Welcome Email');
  const [taskTypePreset, setTaskTypePreset] = useState<string>('email');
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [executionSchedule, setExecutionSchedule] = useState<'NOW' | 'DELAYED' | 'CRON'>('NOW');
  const [delaySeconds, setDelaySeconds] = useState<number>(10);
  const [cronExpression, setCronExpression] = useState<string>('*/5 * * * *');

  // Advanced Options (Collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [priority, setPriority] = useState<number>(0);
  const [maxAttempts, setMaxAttempts] = useState<number>(3);
  const [retryPolicyId, setRetryPolicyId] = useState<string>('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [payloadString, setPayloadString] = useState<string>(
    JSON.stringify(
      {
        taskName: 'Send Welcome Email',
        recipient: 'user@example.com',
        template: 'onboarding_v1',
      },
      null,
      2
    )
  );

  const [jsonError, setJsonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (queues.length > 0 && !selectedQueueId) {
      setSelectedQueueId(queues[0].id);
    }
  }, [queues, selectedQueueId]);

  if (!isOpen) return null;

  const applyTemplate = (templateKey: string) => {
    setJsonError(null);
    switch (templateKey) {
      case 'email':
        setJobTitle('Send Welcome Email');
        setExecutionSchedule('NOW');
        setMaxAttempts(3);
        setPayloadString(
          JSON.stringify(
            {
              type: 'echo',
              taskName: 'Send Welcome Email',
              recipient: 'new_user@company.com',
              template: 'welcome_series_1',
            },
            null,
            2
          )
        );
        break;
      case 'report':
        setJobTitle('Generate Monthly Sales Report');
        setExecutionSchedule('NOW');
        setMaxAttempts(3);
        setPayloadString(
          JSON.stringify(
            {
              type: 'echo',
              taskName: 'Generate Monthly Sales Report',
              format: 'PDF',
              period: 'Last 30 Days',
              sendNotification: true,
            },
            null,
            2
          )
        );
        break;
      case 'delayed':
        setJobTitle('Delayed Order Confirmation');
        setExecutionSchedule('DELAYED');
        setDelaySeconds(10);
        setMaxAttempts(3);
        setPayloadString(
          JSON.stringify(
            {
              type: 'echo',
              taskName: 'Delayed Order Confirmation',
              orderId: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
              delaySec: 10,
            },
            null,
            2
          )
        );
        break;
      case 'fail-once':
        setJobTitle('Sync Inventory with Supplier (Auto-Retry Demo)');
        setExecutionSchedule('NOW');
        setMaxAttempts(3);
        setPayloadString(
          JSON.stringify(
            {
              type: 'fail-once',
              taskName: 'Sync Inventory with Supplier',
              endpoint: 'https://supplier-api.example.com/v2/items',
              note: 'Will simulate a network timeout on Attempt 1, then succeed automatically on Attempt 2!',
            },
            null,
            2
          )
        );
        break;
      case 'fatal-dlq':
        setJobTitle('Payment Gateway Settlement (Fatal DLQ Demo)');
        setExecutionSchedule('NOW');
        setMaxAttempts(3);
        setPayloadString(
          JSON.stringify(
            {
              type: 'fail',
              taskName: 'Payment Gateway Settlement',
              error: 'Card processor declined transaction: ERR_CODE_EXPIRED_TOKEN',
              note: 'Will fail 3 times sequentially, exhaust retries, and quarantine to Failed Jobs (DLQ).',
            },
            null,
            2
          )
        );
        break;
      case 'sleep':
        setJobTitle('Transcode 4K Video (Long Running)');
        setExecutionSchedule('NOW');
        setMaxAttempts(3);
        setPayloadString(
          JSON.stringify(
            {
              type: 'sleep',
              taskName: 'Transcode 4K Video',
              durationMs: 4000,
              dimensions: '3840x2160',
              note: 'Runs for 4 seconds to observe RUNNING state and worker heartbeat lease renewal.',
            },
            null,
            2
          )
        );
        break;
      case 'cron':
        setJobTitle('Hourly Database Cleanup');
        setExecutionSchedule('CRON');
        setCronExpression('0 * * * *');
        setMaxAttempts(3);
        setPayloadString(
          JSON.stringify(
            {
              type: 'echo',
              taskName: 'Hourly Database Cleanup',
              targetTables: ['temp_uploads', 'session_cache'],
            },
            null,
            2
          )
        );
        break;
    }
  };

  const handleGenerateUUID = () => {
    setIdempotencyKey(`idem-${crypto.randomUUID()}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate JSON
    let parsedPayload: any = {};
    try {
      parsedPayload = JSON.parse(payloadString);
      // Inject taskName if missing
      if (!parsedPayload.taskName) {
        parsedPayload.taskName = jobTitle.trim() || 'Custom Task';
      }
    } catch (err: any) {
      setJsonError(`Invalid JSON format: ${err.message}`);
      setShowAdvanced(true);
      return;
    }

    if (!selectedQueueId) {
      setSubmitError('Please select a queue');
      return;
    }

    setSubmitting(true);
    try {
      const type =
        executionSchedule === 'DELAYED'
          ? 'DELAYED'
          : executionSchedule === 'CRON'
          ? 'CRON'
          : 'IMMEDIATE';

      const submissionData: any = {
        type,
        payload: parsedPayload,
        priority,
        maxAttempts,
      };

      if (executionSchedule === 'DELAYED') {
        submissionData.delayMs = delaySeconds * 1000;
      } else if (executionSchedule === 'CRON') {
        submissionData.cronExpression = cronExpression;
      }

      if (retryPolicyId) {
        submissionData.retryPolicyId = retryPolicyId;
      }

      if (idempotencyKey.trim()) {
        submissionData.idempotencyKey = idempotencyKey.trim();
      }

      const created = await Api.createJob(selectedQueueId, submissionData);
      onJobCreated(created);
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Plus className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900">Create New Job</h2>
              <p className="text-xs text-slate-500">Configure and submit a background task</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {submitError}
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2 flex items-center space-x-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>Quick Task Presets (Click to Auto-Fill)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyTemplate('email')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-50/60 hover:border-indigo-200 text-left transition cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-800 block">⚡ Welcome Email</span>
                <span className="text-[11px] text-slate-500">Runs instantly</span>
              </button>

              <button
                type="button"
                onClick={() => applyTemplate('report')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-50/60 hover:border-indigo-200 text-left transition cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-800 block">📊 Sales PDF Report</span>
                <span className="text-[11px] text-slate-500">Fast compute</span>
              </button>

              <button
                type="button"
                onClick={() => applyTemplate('delayed')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-50/60 hover:border-indigo-200 text-left transition cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-800 block">⏱️ Delayed (10s)</span>
                <span className="text-[11px] text-slate-500">Runs in 10s</span>
              </button>

              <button
                type="button"
                onClick={() => applyTemplate('fail-once')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-orange-50/60 hover:border-orange-200 text-left transition cursor-pointer"
              >
                <span className="text-xs font-semibold text-orange-700 block">🔄 Retry Recovery</span>
                <span className="text-[11px] text-slate-500">Fails 1st, succeeds 2nd</span>
              </button>

              <button
                type="button"
                onClick={() => applyTemplate('fatal-dlq')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-rose-50/60 hover:border-rose-200 text-left transition cursor-pointer"
              >
                <span className="text-xs font-semibold text-rose-700 block">🚨 Error to DLQ</span>
                <span className="text-[11px] text-slate-500">Fails 3x → Quarantine</span>
              </button>

              <button
                type="button"
                onClick={() => applyTemplate('sleep')}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/60 hover:border-blue-200 text-left transition cursor-pointer"
              >
                <span className="text-xs font-semibold text-blue-700 block">⏳ 4s Long Run</span>
                <span className="text-[11px] text-slate-500">Tests heartbeat lease</span>
              </button>
            </div>
          </div>

          {/* Primary Step 1: Job Name */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Task Name / What should it do? *
            </label>
            <input
              type="text"
              required
              value={jobTitle}
              onChange={(e) => {
                const val = e.target.value;
                setJobTitle(val);
                try {
                  const p = JSON.parse(payloadString);
                  p.taskName = val;
                  setPayloadString(JSON.stringify(p, null, 2));
                } catch {
                  // Ignore
                }
              }}
              placeholder="e.g., Send Welcome Email, Process Order #892"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition font-medium"
            />
          </div>

          {/* Primary Step 2: Queue & Execution Timing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Queue */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Target Queue *
              </label>
              <select
                value={selectedQueueId}
                onChange={(e) => setSelectedQueueId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
                required
              >
                {queues.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name} ({q.isPaused ? 'Paused' : 'Active'})
                  </option>
                ))}
              </select>
            </div>

            {/* When should it run? */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                When should it run?
              </label>
              <select
                value={executionSchedule}
                onChange={(e) => setExecutionSchedule(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
              >
                <option value="NOW">Run Immediately</option>
                <option value="DELAYED">Delay by X seconds</option>
                <option value="CRON">Recurring Schedule (Cron)</option>
              </select>
            </div>
          </div>

          {/* Conditional Delay Seconds */}
          {executionSchedule === 'DELAYED' && (
            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5">
              <label className="text-xs font-semibold text-amber-900 block">
                Delay Duration (Seconds)
              </label>
              <input
                type="number"
                min="1"
                max="3600"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Math.max(1, Number(e.target.value)))}
                className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-amber-700">
                The job will be placed in QUEUED state and unlocked automatically in {delaySeconds} seconds.
              </p>
            </div>
          )}

          {/* Conditional Cron */}
          {executionSchedule === 'CRON' && (
            <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl space-y-1.5">
              <label className="text-xs font-semibold text-purple-900 block">
                Cron Expression (UTC)
              </label>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="*/5 * * * *"
                className="w-full bg-white border border-purple-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-purple-700">
                Standard 5-part cron syntax (minute hour day-of-month month day-of-week).
              </p>
            </div>
          )}

          {/* Collapsible Advanced Options */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 transition cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <Code className="h-4 w-4 text-indigo-600" />
                <span>Advanced Options (JSON Payload, Priority, Retries, Idempotency)</span>
              </div>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-4 bg-white border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Priority */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Priority: <span className="font-mono text-indigo-600 font-semibold">{priority}</span> (Higher = First)
                    </label>
                    <input
                      type="range"
                      min="-10"
                      max="10"
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>-10 (Low)</span>
                      <span>0 (Normal)</span>
                      <span>+10 (High)</span>
                    </div>
                  </div>

                  {/* Max Retries */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Max Retries Before Failed Jobs: <span className="font-mono text-indigo-600 font-semibold">{maxAttempts}</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Retry Policy */}
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Retry Backoff Strategy
                    </label>
                    <select
                      value={retryPolicyId}
                      onChange={(e) => setRetryPolicyId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Default Queue Policy (Exponential)</option>
                      {retryPolicies.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.strategy})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Idempotency Key */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-700">Idempotency Key</label>
                      <button
                        type="button"
                        onClick={handleGenerateUUID}
                        className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
                      >
                        Generate ID
                      </button>
                    </div>
                    <input
                      type="text"
                      value={idempotencyKey}
                      onChange={(e) => setIdempotencyKey(e.target.value)}
                      placeholder="e.g., txn-98213"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Raw JSON Payload */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700">Raw JSON Payload</label>
                    {jsonError ? (
                      <span className="text-[11px] text-rose-600 font-medium">{jsonError}</span>
                    ) : (
                      <span className="text-[11px] text-emerald-600 font-medium flex items-center space-x-1">
                        <Check className="h-3 w-3" />
                        <span>Valid JSON</span>
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={6}
                    value={payloadString}
                    onChange={(e) => {
                      setPayloadString(e.target.value);
                      try {
                        JSON.parse(e.target.value);
                        setJsonError(null);
                      } catch (err: any) {
                        setJsonError(err.message);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white leading-relaxed resize-y"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (showAdvanced && !!jsonError)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{submitting ? 'Submitting Task...' : 'Submit Job to Queue'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
