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
  getSessions: (limit = 50) =>
    apiRequest<SessionsResponse>(`/api/sessions?limit=${limit}`),

  getSession: (sessionId: string) =>
    apiRequest<InterviewSession>(`/api/sessions/${sessionId}`),
};
