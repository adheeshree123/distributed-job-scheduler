import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Play,
  Layers,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { ScheduledJob } from '../types';

export const CronView: React.FC = () => {
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchScheduledJobs = () => {
    setLoading(true);
    fetch('/api/scheduled-jobs')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setScheduledJobs(data.data);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchScheduledJobs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Recurring Schedules</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              Cron Engine
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Automate tasks to run on fixed schedules (e.g. hourly database cleanups, daily reports, weekly billing invoices).
          </p>
        </div>

        <button
          onClick={fetchScheduledJobs}
          className="flex items-center space-x-1.5 p-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition cursor-pointer text-xs font-medium self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scheduledJobs.length === 0 ? (
          <div className="col-span-full p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">No Recurring Schedules Configured</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When creating a job, select the "Recurring Schedule (Cron)" option to configure an automatic repeat cycle.
            </p>
          </div>
        ) : (
          scheduledJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-slate-300 shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{job.name}</h3>
                  <span className="text-xs font-mono text-indigo-600 font-semibold mt-0.5 block">
                    {job.cronExpression} ({job.timezone})
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    job.isEnabled
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {job.isEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Next Run:</span>
                  <span className="text-slate-800 font-semibold">
                    {new Date(job.nextRunAt).toLocaleString()}
                  </span>
                </div>
                {job.lastRunAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Last Execution:</span>
                    <span className="text-slate-600">
                      {new Date(job.lastRunAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
