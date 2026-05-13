// =============================================
// 心理咨询模块 — API 客户端
// 模式匹配 src/components/scoring/services/scoringApi.ts
// =============================================

import type {
  Counselor,
  CounselorSlot,
  ChatConversation,
  ChatMessage,
  Appointment,
  AppointmentStatus,
  ApiResponse,
} from '../components/psychology/types/psychology';

const BASE_URL = '/api/psychology';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: getAuthHeaders(),
    ...options,
  });
  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new Error(`请求失败 (${res.status})`);
  }
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data as T;
}

// =============================================
// 咨询师 API
// =============================================

export const counselorApi = {
  list: (all?: boolean) => {
    const query = all ? '?all=1' : '';
    return request<Counselor[]>(`/counselors${query}`);
  },

  get: (id: number) => request<Counselor>(`/counselors/${id}`),

  /** 获取当前用户的咨询师档案（null = 非咨询师） */
  me: () => request<Counselor | null>('/me'),

  create: (data: {
    user_id: number;
    name: string;
    title?: string;
    bio?: string;
    avatar_url?: string;
  }) =>
    request<{ id: number }>('/counselors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    id: number,
    data: { name?: string; title?: string; bio?: string; avatar_url?: string }
  ) =>
    request<void>(`/counselors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggle: (id: number) =>
    request<void>(`/counselors/${id}/toggle`, { method: 'PUT' }),

  addSlot: (counselorId: number, data: Omit<CounselorSlot, 'id'>) =>
    request<{ id: number }>(`/counselors/${counselorId}/slots`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteSlot: (counselorId: number, slotId: number) =>
    request<void>(`/counselors/${counselorId}/slots/${slotId}`, {
      method: 'DELETE',
    }),
};

// =============================================
// 聊天 API
// =============================================

export const chatApi = {
  getConversations: () => request<ChatConversation[]>('/chat/conversations'),

  createConversation: (counselorId: number) =>
    request<{ id: number }>('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ counselor_id: counselorId }),
    }),

  getMessages: (conversationId: number, since?: string) => {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return request<ChatMessage[]>(`/chat/${conversationId}/messages${query}`);
  },

  sendMessage: (conversationId: number, content: string) =>
    request<{ id: number }>(`/chat/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

// =============================================
// 预约 API
// =============================================

export const appointmentApi = {
  getMyAppointments: () => request<Appointment[]>('/appointments'),

  getManageAppointments: (status?: AppointmentStatus) => {
    const query = status ? `?status=${status}` : '';
    return request<Appointment[]>(`/appointments/manage${query}`);
  },

  getAllAppointments: (status?: AppointmentStatus) => {
    const query = status ? `?status=${status}` : '';
    return request<Appointment[]>(`/appointments/all${query}`);
  },

  create: (data: {
    counselor_id: number;
    slot_date: string;
    slot_start: string;
    slot_end: string;
    conversation_id?: number | null;
  }) =>
    request<{ id: number }>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  confirm: (id: number) =>
    request<void>(`/appointments/${id}/confirm`, { method: 'PUT' }),

  complete: (id: number, notes?: string | null) =>
    request<void>(`/appointments/${id}/complete`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),

  cancel: (id: number) =>
    request<void>(`/appointments/${id}/cancel`, { method: 'PUT' }),
};
