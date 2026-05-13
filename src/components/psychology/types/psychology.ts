// =============================================
// 心理咨询模块 — 类型定义
// 与后端 src/routes/psychology/ 合约一致
// =============================================

export interface Counselor {
  id: number;
  user_id: number;
  name: string;
  title: string;
  bio: string;
  avatar_url: string | null;
  is_active: number;
  created_at: string;
  slots: CounselorSlot[];
}

export interface CounselorSlot {
  id?: number;
  day_of_week: number; // 1=周一 7=周日
  start_time: string;  // HH:MM:SS
  end_time: string;    // HH:MM:SS
}

export interface ChatConversation {
  id: number;
  student_user_id: number;
  counselor_id: number;
  is_active: number;
  created_at: string;
  counselor_name: string;
  avatar_url: string | null;
  unread_count: number | string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_role: 'student' | 'counselor';
  sender_id: number;
  content: string;
  read_at: string | null;
  created_at: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: number;
  student_user_id: number;
  counselor_id: number;
  conversation_id: number | null;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  // joined fields
  counselor_name?: string;
  student_name?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type PsychView =
  | 'counselors'
  | 'counselor-detail'
  | 'chat'
  | 'my-appointments'
  | 'workbench'
  | 'manage'
  | 'appointments-overview';
