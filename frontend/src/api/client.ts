const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8052';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'watchme-b2b-poc-2025';

export interface InterviewSession {
  id: string;
  facility_id: string;
  subject_id: string;
  staff_id?: string | null;
  s3_audio_path: string;
  transcription?: string | null;
  status: 'uploaded' | 'transcribing' | 'transcribed' | 'analyzing' | 'completed' | 'error';
  duration_seconds?: number | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  fact_extraction_prompt_v1?: string | null;
  fact_extraction_result_v1?: { summary: string } | string | null;
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
  subjects?: {
    subject_id: string;
    name: string;
    age?: number | null;
    gender?: string | null;
    avatar_url?: string | null;
    birth_date?: string | null;
  } | null;

  // Editable fields
  facility_name?: string | null;
  manager_name?: string | null;
  monitoring_start?: string | null;
  monitoring_end?: string | null;
  child_birth_date?: string | null;
  guardian_name?: string | null;
  child_intention?: string | null;
  family_intention?: string | null;
  service_schedule?: string | null;
  notes?: string | null;
  general_policy?: string | null;
  long_term_goal?: string | null;
  long_term_period?: string | null;
  short_term_goal?: string | null;
  short_term_period?: string | null;
  support_items?: SupportItem[] | null;
  explainer_name?: string | null;
  consent_date?: string | null;
  guardian_signature?: string | null;
}

export interface SupportItem {
  category: string;
  target: string;
  content: string;
  timeline: string;
  staff: string;
  notes: string;
  priority: number;
}

export interface SupportPlanCreate {
  subject_id: string;
  title: string;
  plan_number?: string | null;
  status?: 'draft' | 'active';
}

export interface SupportPlanUpdate {
  title?: string;
  plan_number?: string | null;
  status?: 'draft' | 'active' | 'completed' | 'archived';
  subject_id?: string | null;
  // Header information
  facility_name?: string | null;
  manager_name?: string | null;
  monitoring_start?: string | null;
  monitoring_end?: string | null;
  // Child information
  child_birth_date?: string | null;
  guardian_name?: string | null;
  // Intentions
  child_intention?: string | null;
  family_intention?: string | null;
  // Service schedule
  service_schedule?: string | null;
  // Notes
  notes?: string | null;
  // General policy
  general_policy?: string | null;
  // Goals
  long_term_goal?: string | null;
  long_term_period?: string | null;
  short_term_goal?: string | null;
  short_term_period?: string | null;
  // Support items (7-column table data)
  support_items?: SupportItem[] | null;
  // Consent information
  explainer_name?: string | null;
  consent_date?: string | null;
  guardian_signature?: string | null;
}

export interface SupportPlansResponse {
  support_plans: SupportPlan[];
  count: number;
}


// Subject interfaces
export interface Subject {
  id: string;
  facility_id: string;
  name: string;
  age?: number | null;
  gender?: string | null;
  avatar_url?: string | null;
  notes?: string | null;
  prefecture?: string | null;
  city?: string | null;
  cognitive_type?: string | null;
  birth_date?: string | null;
  diagnosis?: string[] | null;
  school_name?: string | null;
  school_type?: string | null;
  guardians?: any | null;

  created_at: string;
  updated_at: string;
}

export interface SubjectsResponse {
  subjects: Subject[];
  analytics: {
    total_count: number;
    gender_distribution: {
      male: number;
      female: number;
      other: number;
      unknown: number;
    };
    age_groups: {
      "0-3": number;
      "4-6": number;
      "7-9": number;
      "10+": number;
      unknown: number;
    };
  };
}

export interface SubjectDetailResponse {
  subject: Subject;
  session_count: number;
  support_plans: SupportPlan[];
}

// User interfaces
export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  role?: string | null;
  facility_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsersResponse {
  users: User[];
  analytics: {
    total_count: number;
    role_distribution: {
      [key: string]: number;
    };
  };
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

  // Subjects API
  getSubjects: (facilityId?: string) => {
    let url = `/api/subjects?limit=100`;
    if (facilityId) {
      url += `&facility_id=${facilityId}`;
    }
    return apiRequest<SubjectsResponse>(url);
  },

  getSubject: (subjectId: string) =>
    apiRequest<SubjectDetailResponse>(`/api/subjects/${subjectId}`),

  createSubject: (data: { facility_id: string; name: string; age?: number; gender?: string; notes?: string; birth_date?: string }) =>
    apiRequest<Subject>(`/api/subjects`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),


  linkSubject: (subjectId: string, facilityId: string) =>
    apiRequest<{ success: boolean; message: string }>(`/api/subjects/${subjectId}/link`, {
      method: 'POST',
      body: JSON.stringify({ facility_id: facilityId }),
    }),

  // Users API
  getUsers: (facilityId?: string) => {
    let url = `/api/users?limit=100`;
    if (facilityId) {
      url += `&facility_id=${facilityId}`;
    }
    return apiRequest<UsersResponse>(url);
  },
};
