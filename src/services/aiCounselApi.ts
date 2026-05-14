// AI 心理咨询 API — SSE 流式 + REST

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/ai${url}`, { headers: getAuthHeaders(), ...options });
  const json: ApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data as T;
}

export interface CounselSession {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface CounselMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const aiCounselApi = {
  createSession: () => request<{ id: number }>('/counsel/sessions', { method: 'POST' }),

  getSessions: () => request<CounselSession[]>('/counsel/sessions'),

  getMessages: (sessionId: number) => request<CounselMessage[]>(`/counsel/sessions/${sessionId}/messages`),

  saveMessage: (sessionId: number, role: 'user' | 'assistant', content: string) =>
    request<{ id: number }>(`/counsel/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, content }),
    }),

  deleteSession: (id: number) => request<void>(`/counsel/sessions/${id}`, { method: 'DELETE' }),

  /** SSE 流式请求 — 返回 ReadableStream */
  streamChat: (messages: { role: string; content: string }[], sessionId: number, signal?: AbortSignal) => {
    const token = localStorage.getItem('auth_token');
    return fetch('/api/ai/counsel/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages, session_id: sessionId }),
      signal,
    });
  },
};
