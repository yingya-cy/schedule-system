// AI 排课 API 客户端 — 仿 scoringApi.ts request<T> 模式

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

export interface SchedulePlan {
  id: number;
  term_id: number | null;
  plan_data: PlanData;
  created_at: string;
}

export interface PlanData {
  weekly_plans: WeeklyPlan[];
  summary: string;
}

export interface WeeklyPlan {
  week_start: string;
  daily_plans: DailyPlan[];
}

export interface DailyPlan {
  date: string;
  day_of_week: number;
  time_blocks: TimeBlock[];
}

export interface TimeBlock {
  start: string;
  end: string;
  task: string;
  type: 'study' | 'class' | 'activity' | 'break';
  priority: 'high' | 'medium' | 'low';
  note: string;
}

export const aiScheduleApi = {
  generatePlan: (data: {
    courses: unknown[];
    commitments: unknown[];
    grade?: string;
    major?: string;
    next_monday: string;
    term_id?: number;
  }) =>
    request<{ id: number; plan: PlanData }>('/schedule-plan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPlans: () => request<SchedulePlan[]>('/schedule-plans'),

  getPlan: (id: number) => request<SchedulePlan>(`/schedule-plans/${id}`),

  deletePlan: (id: number) => request<void>(`/schedule-plans/${id}`, { method: 'DELETE' }),
};
