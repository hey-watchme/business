const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8052';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'watchme-b2b-poc-2025';

export interface InterviewSession {
  id: string;
  facility_id: string;
  child_id: string;
  staff_id?: string | null;
  s3_audio_path: string;
  transcription?: string | null;
  status: 'uploaded' | 'transcribing' | 'transcribed' | 'analyzing' | 'completed' | 'error';
  duration_seconds?: number | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  analysis_prompt?: string | null;
  analysis_result?: string | null;
  error_message?: string | null;
  transcription_metadata?: string | null;
}

export interface SessionsResponse {
  sessions: InterviewSession[];
  count: number;
}

// Support Plan interfaces
export interface SupportPlan {
  id: string;
  facility_id: string;
  title: string;
  plan_number?: string | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
  subject_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  session_count?: number;
  sessions?: InterviewSession[];
}

export interface SupportPlanCreate {
  title: string;
  plan_number?: string | null;
  status?: 'draft' | 'active';
  subject_id?: string | null;
}

export interface SupportPlanUpdate {
  title?: string;
  plan_number?: string | null;
  status?: 'draft' | 'active' | 'completed' | 'archived';
  subject_id?: string | null;
}

export interface SupportPlansResponse {
  support_plans: SupportPlan[];
  count: number;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'X-API-Token': API_TOKEN,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Sessions API
  getSessions: (limit = 50, supportPlanId?: string) => {
    let url = `/api/sessions?limit=${limit}`;
    if (supportPlanId) {
      url += `&support_plan_id=${supportPlanId}`;
    }
    return apiRequest<SessionsResponse>(url);
  },

  getSession: (sessionId: string) =>
    apiRequest<InterviewSession>(`/api/sessions/${sessionId}`),

  // Support Plans API
  getSupportPlans: () =>
    apiRequest<{ plans: SupportPlan[]; count: number }>(`/api/support-plans`).then(data => data.plans),

  createSupportPlan: (data: SupportPlanCreate) =>
    apiRequest<SupportPlan>(`/api/support-plans`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSupportPlan: (planId: string) =>
    apiRequest<SupportPlan>(`/api/support-plans/${planId}`),

  updateSupportPlan: (planId: string, data: SupportPlanUpdate) =>
    apiRequest<SupportPlan>(`/api/support-plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSupportPlan: (planId: string) =>
    apiRequest<void>(`/api/support-plans/${planId}`, {
      method: 'DELETE',
    }),
};
