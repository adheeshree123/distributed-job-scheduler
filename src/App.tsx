import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  ListOrdered,
  Layers,
  Cpu,
  Calendar,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Settings2,
  Plus,
  Zap,
  BookOpen,
} from 'lucide-react';
import {
  Job,
  Queue,
  WorkerInfo,
  DashboardMetrics,
  WorkerDaemonStatus,
  RetryPolicy,
} from './types';
import { Api } from './services/api';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { JobsView } from './components/JobsView';
import { QueuesView } from './components/QueuesView';
import { WorkersView } from './components/WorkersView';
import { DLQView } from './components/DLQView';
import { CronView } from './components/CronView';
import { ArchitectureView } from './components/ArchitectureView';
import { SettingsView } from './components/SettingsView';
import { CreateJobModal } from './components/CreateJobModal';
import { JobDetailDrawer } from './components/JobDetailDrawer';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'jobs' | 'queues' | 'workers' | 'failed' | 'schedules' | 'system' | 'settings'
  >('dashboard');

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [daemonStatus, setDaemonStatus] = useState<WorkerDaemonStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [retryPolicies, setRetryPolicies] = useState<RetryPolicy[]>([]);

  // Filters & Drawer State
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [queueFilter, setQueueFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(1500);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(
    null
  );

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // Main Data Fetcher
  const fetchData = useCallback(async (silent = true) => {
    if (!silent) setIsRefreshing(true);

    try {
      const [metricsData, daemonData, queuesData, jobsData, workersData, policiesData] = await Promise.all([
        Api.getMetrics().catch(() => null),
        Api.getDaemonStatus().catch(() => null),
        Api.listQueues().catch(() => []),
        Api.listJobs({
          status: statusFilter || undefined,
          queueId: queueFilter || undefined,
          search: searchQuery || undefined,
          page: currentPage,
          limit: 25,
        }).catch(() => ({ data: [], meta: { total: 0, totalPages: 1, page: 1, limit: 25 } })),
        Api.listWorkers().catch(() => []),
        Api.listRetryPolicies().catch(() => []),
      ]);

      if (metricsData) setMetrics(metricsData);
      if (daemonData) setDaemonStatus(daemonData);
      if (queuesData) setQueues(queuesData);
      if (jobsData) {
        setJobs(jobsData.data);
        setTotalJobs(jobsData.meta.total);
        setTotalPages(jobsData.meta.totalPages);
      }
      if (workersData) setWorkers(workersData);
      if (policiesData) setRetryPolicies(policiesData);

      // If a job is currently inspected in drawer, refresh its state
      if (selectedJob && jobsData?.data) {
        const updatedSelected = jobsData.data.find((j: Job) => j.id === selectedJob.id);
        if (updatedSelected) {
          setSelectedJob(updatedSelected);
        }
      }
    } catch (err) {
      console.error('Error polling dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [statusFilter, queueFilter, searchQuery, currentPage, selectedJob]);

  // Polling Loop
  useEffect(() => {
    fetchData(false);

    if (refreshInterval > 0) {
      timerRef.current = setInterval(() => {
        fetchData(true);
      }, refreshInterval);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData, refreshInterval]);

  // Worker Daemon Actions
  const handleStartDaemon = async () => {
    try {
      await Api.startDaemon();
      showNotification('Worker engine activated (auto-polling mode)');
      fetchData(false);
    } catch (err: any) {
      showNotification(`Failed to start worker: ${err.message}`, 'error');
    }
  };

  const handleStopDaemon = async () => {
    try {
      await Api.stopDaemon();
      showNotification('Worker engine paused');
      fetchData(false);
    } catch (err: any) {
      showNotification(`Failed to stop worker: ${err.message}`, 'error');
    }
  };

  const handleStepDaemon = async () => {
    try {
      const res = await Api.stepDaemon();
      showNotification(res.message, res.claimedCount > 0 ? 'success' : 'info');
      fetchData(false);
    } catch (err: any) {
      showNotification(`Error stepping worker: ${err.message}`, 'error');
    }
  };

  const handleRetryJob = async (id: string) => {
    try {
      const updated = await Api.retryJob(id);
      showNotification(`Job re-queued for execution!`);
      setSelectedJob(updated);
      fetchData(false);
    } catch (err: any) {
      showNotification(`Failed to retry job: ${err.message}`, 'error');
    }
  };

  const handleJobCreated = (newJob: Job) => {
    showNotification(`Job created and placed in queue!`);
    setSelectedJob(newJob);
    fetchData(false);
  };

  const handleQuickLaunch = async (templateType: string) => {
    if (queues.length === 0) {
      showNotification('No active queues found', 'error');
      return;
    }
    const targetQueue = queues[0].id;
    let jobData: any = { type: 'IMMEDIATE', priority: 0, maxAttempts: 3 };

    if (templateType === 'echo') {
      jobData.payload = {
        type: 'echo',
        taskName: 'Send Welcome Email',
        recipient: 'user@example.com',
      };
    } else if (templateType === 'fail-once') {
      jobData.payload = {
        type: 'fail-once',
        taskName: 'Sync External API (Auto-Retry Demo)',
        note: 'Fails on attempt 1, automatically succeeds on attempt 2',
      };
    } else if (templateType === 'fatal-dlq') {
      jobData.payload = {
        type: 'fail',
        taskName: 'Payment Gateway (Fatal DLQ Demo)',
        error: 'Card processor declined token: FATAL_UNAUTHORIZED',
      };
    } else if (templateType === 'sleep') {
      jobData.payload = {
        type: 'sleep',
        taskName: 'Transcode 4K Video (Long Running)',
        durationMs: 4000,
      };
    }

    try {
      const created = await Api.createJob(targetQueue, jobData);
      showNotification(`Launched "${jobData.payload.taskName}"!`);
      setSelectedJob(created);
      fetchData(false);
    } catch (err: any) {
      showNotification(`Failed to launch task: ${err.message}`, 'error');
    }
  };

  const handleNavigateTab = (tab: any, filter?: string) => {
    setActiveTab(tab);
    if (filter !== undefined) {
      setStatusFilter(filter);
    }
  };

  const dlqCount = metrics?.dlqJobs ?? 0;

  return (
    <div
      id="app-root"
      className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white"
    >
      {/* Top Navbar Header */}
      <Navbar
        daemonStatus={daemonStatus}
        onStartDaemon={handleStartDaemon}
        onStopDaemon={handleStopDaemon}
        onStepDaemon={handleStepDaemon}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        refreshInterval={refreshInterval}
        setRefreshInterval={setRefreshInterval}
        onManualRefresh={() => fetchData(false)}
        isRefreshing={isRefreshing}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 transition transform animate-in slide-in-from-bottom-5">
          <div
            className={`px-4 py-3 rounded-2xl border text-xs font-semibold shadow-xl flex items-center space-x-2 ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : notification.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-indigo-50 text-indigo-800 border-indigo-300'
            }`}
          >
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-4 lg:p-6 gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-56 flex-shrink-0 hidden md:block space-y-4">
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
              Main Menu
            </div>

            {/* Dashboard */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            {/* Jobs */}
            <button
              onClick={() => setActiveTab('jobs')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'jobs'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <ListOrdered className="h-4 w-4" />
                <span>Jobs</span>
              </div>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                  activeTab === 'jobs' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {metrics?.totalJobs ?? 0}
              </span>
            </button>

            {/* Queues */}
            <button
              onClick={() => setActiveTab('queues')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'queues'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Layers className="h-4 w-4" />
                <span>Queues</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">{queues.length}</span>
            </button>

            {/* Workers */}
            <button
              onClick={() => setActiveTab('workers')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'workers'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Cpu className="h-4 w-4" />
                <span>Workers</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">{workers.length}</span>
            </button>

            {/* Schedules */}
            <button
              onClick={() => setActiveTab('schedules')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'schedules'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Schedules</span>
            </button>

            {/* Failed Jobs */}
            <button
              onClick={() => setActiveTab('failed')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'failed'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <AlertOctagon className="h-4 w-4 text-rose-500" />
                <span>Failed Jobs</span>
              </div>
              {dlqCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
                  {dlqCount}
                </span>
              )}
            </button>

            <div className="pt-2 px-3 pb-1 text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold">
              Engineering
            </div>

            {/* System Specs */}
            <button
              onClick={() => setActiveTab('system')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>System & Specs</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Settings2 className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </div>

          {/* Helper Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-xs space-y-2">
            <div className="flex items-center space-x-1.5 text-indigo-600 font-semibold text-[11px] uppercase tracking-wider">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Quick Tip</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Use <strong>+ Create Job</strong> to launch background tasks, or run 1-click test tasks from the dashboard.
            </p>
          </div>
        </aside>

        {/* Primary Content View */}
        <main className="flex-1 space-y-6 min-w-0">
          {activeTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              jobs={jobs}
              queues={queues}
              daemonStatus={daemonStatus}
              onSelectJob={setSelectedJob}
              onRetryJob={handleRetryJob}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
              onQuickLaunch={handleQuickLaunch}
              onNavigateTab={handleNavigateTab}
              onStepDaemon={handleStepDaemon}
            />
          )}

          {activeTab === 'jobs' && (
            <JobsView
              jobs={jobs}
              queues={queues}
              totalJobs={totalJobs}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              queueFilter={queueFilter}
              onQueueFilterChange={setQueueFilter}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSelectJob={setSelectedJob}
              onRetryJob={handleRetryJob}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
              onStepDaemon={handleStepDaemon}
              isLoading={isRefreshing}
            />
          )}

          {activeTab === 'queues' && (
            <QueuesView queues={queues} onRefresh={() => fetchData(false)} />
          )}

          {activeTab === 'workers' && (
            <WorkersView
              workers={workers}
              daemonStatus={daemonStatus}
              onStartDaemon={handleStartDaemon}
              onStopDaemon={handleStopDaemon}
              onStepDaemon={handleStepDaemon}
              onRefresh={() => fetchData(false)}
            />
          )}

          {activeTab === 'failed' && (
            <DLQView onRetrySuccess={() => fetchData(false)} />
          )}

          {activeTab === 'schedules' && <CronView />}

          {activeTab === 'system' && <ArchitectureView />}

          {activeTab === 'settings' && (
            <SettingsView
              refreshInterval={refreshInterval}
              setRefreshInterval={setRefreshInterval}
            />
          )}
        </main>
      </div>

      {/* Create Job Modal */}
      <CreateJobModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        queues={queues}
        retryPolicies={retryPolicies}
        onJobCreated={handleJobCreated}
      />

      {/* Deep Inspection Drawer */}
      <JobDetailDrawer
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onRetry={handleRetryJob}
      />
    </div>
  );
}
