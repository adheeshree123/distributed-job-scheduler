import {
  Job,
  Queue,
  WorkerInfo,
  DeadLetterJob,
  DashboardMetrics,
  WorkerDaemonStatus,
  RetryPolicy,
  ScheduledJob,
  JobExecution,
  JobLog,
} from '../types';

let cachedToken: string | null = localStorage.getItem('scheduler_jwt');

export async function getAuthToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    // Attempt login with default admin credentials
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice.admin@scheduler.io',
        password: 'AdminPass123!',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      cachedToken = data.data.token;
      localStorage.setItem('scheduler_jwt', cachedToken!);
      return cachedToken!;
    }
  } catch (err) {
    console.warn('Auto-login attempt 1 failed:', err);
  }

  // Fallback: register default user if DB was freshly migrated
  try {
    const regRes = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice.admin@scheduler.io',
        password: 'AdminPass123!',
        name: 'Alice System Admin',
        organizationName: 'Primary Tech Org',
      }),
    });
    if (regRes.ok) {
      const data = await regRes.json();
      cachedToken = data.data.token;
      localStorage.setItem('scheduler_jwt', cachedToken!);
      return cachedToken!;
    }
  } catch (err) {
    console.error('Auto-registration failed:', err);
  }

  return '';
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token may have expired, clear cache and retry once
    localStorage.removeItem('scheduler_jwt');
    cachedToken = null;
    const newToken = await getAuthToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      const retryResponse = await fetch(url, { ...options, headers });
      if (!retryResponse.ok) {
        const errData = await retryResponse.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Request failed with status ${retryResponse.status}`);
      }
      return retryResponse.json() as Promise<T>;
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || errData?.message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const Api = {
  async getHealth() {
    const res = await fetch('/api/health');
    return res.json();
  },

  async getMetrics(): Promise<DashboardMetrics> {
    const res = await apiFetch<{ success: boolean; data: DashboardMetrics }>('/api/jobs/metrics/summary');
    return res.data;
  },

  async listJobs(params: {
    status?: string;
    queueId?: string;
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: Job[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.queueId) query.set('queueId', params.queueId);
    if (params.type) query.set('type', params.type);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());

    const res = await apiFetch<{
      success: boolean;
      data: Job[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(`/api/jobs?${query.toString()}`);
    return { data: res.data, meta: res.meta };
  },

  async getJob(id: string): Promise<Job> {
    const res = await apiFetch<{ success: boolean; data: Job }>(`/api/jobs/${id}`);
    return res.data;
  },

  async getJobExecutions(id: string): Promise<JobExecution[]> {
    const res = await apiFetch<{ success: boolean; data: JobExecution[] }>(`/api/jobs/${id}/executions`);
    return res.data;
  },

  async getJobLogs(id: string): Promise<JobLog[]> {
    const res = await apiFetch<{ success: boolean; data: JobLog[] }>(`/api/jobs/${id}/logs`);
    return res.data;
  },

  async createJob(queueId: string, payload: any): Promise<Job> {
    const res = await apiFetch<{ success: boolean; data: Job }>(`/api/queues/${queueId}/jobs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async retryJob(id: string): Promise<Job> {
    const res = await apiFetch<{ success: boolean; data: Job }>(`/api/jobs/${id}/retry`, {
      method: 'POST',
    });
    return res.data;
  },

  async listQueues(): Promise<Queue[]> {
    const res = await apiFetch<{ success: boolean; data: Queue[] }>('/api/queues');
    return res.data;
  },

  async createQueue(payload: { name: string; description?: string; concurrencyLimit?: number; priority?: number; projectId?: string }): Promise<Queue> {
    const queues = await this.listQueues();
    const projectId = payload.projectId || queues[0]?.projectId || 'default-project-id';
    const res = await apiFetch<{ success: boolean; data: Queue }>(`/api/projects/${projectId}/queues`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async pauseQueue(id: string): Promise<Queue> {
    const res = await apiFetch<{ success: boolean; data: Queue }>(`/api/queues/${id}/pause`, {
      method: 'POST',
    });
    return res.data;
  },

  async resumeQueue(id: string): Promise<Queue> {
    const res = await apiFetch<{ success: boolean; data: Queue }>(`/api/queues/${id}/resume`, {
      method: 'POST',
    });
    return res.data;
  },

  async listWorkers(): Promise<WorkerInfo[]> {
    const res = await apiFetch<{ success: boolean; data: WorkerInfo[] }>('/api/workers');
    return res.data;
  },

  async getDaemonStatus(): Promise<WorkerDaemonStatus> {
    const res = await apiFetch<{ success: boolean; data: WorkerDaemonStatus }>('/api/workers/daemon/status');
    return res.data;
  },

  async startDaemon(options?: { concurrency?: number; pollIntervalMs?: number }) {
    const res = await apiFetch<{ success: boolean; data: any }>('/api/workers/daemon/start', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
    return res.data;
  },

  async stopDaemon() {
    const res = await apiFetch<{ success: boolean; data: any }>('/api/workers/daemon/stop', {
      method: 'POST',
    });
    return res.data;
  },

  async stepDaemon() {
    const res = await apiFetch<{ success: boolean; data: { success: boolean; claimedCount: number; message: string } }>(
      '/api/workers/daemon/step',
      { method: 'POST' }
    );
    return res.data;
  },

  async spawnSecondaryWorker() {
    const res = await apiFetch<{ success: boolean; data: any }>('/api/workers/daemon/spawn', {
      method: 'POST',
    });
    return res.data;
  },

  async listDLQ(params: { queueId?: string; status?: string; page?: number; limit?: number } = {}): Promise<{
    data: DeadLetterJob[];
    meta: { total: number; page: number; limit: number };
  }> {
    const query = new URLSearchParams();
    if (params.queueId) query.set('queueId', params.queueId);
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());

    const res = await apiFetch<{
      success: boolean;
      data: DeadLetterJob[];
      meta: { total: number; page: number; limit: number };
    }>(`/api/dlq?${query.toString()}`);
    return { data: res.data, meta: res.meta };
  },

  async retryDLQ(id: string) {
    const res = await apiFetch<{ success: boolean; data: any }>(`/api/dlq/${id}/retry`, {
      method: 'POST',
    });
    return res.data;
  },

  async discardDLQ(id: string) {
    const res = await apiFetch<{ success: boolean; data: any }>(`/api/dlq/${id}/discard`, {
      method: 'POST',
    });
    return res.data;
  },

  async listRetryPolicies(): Promise<RetryPolicy[]> {
    const res = await apiFetch<{ success: boolean; data: RetryPolicy[] }>('/api/retry-policies');
    return res.data;
  },
};
