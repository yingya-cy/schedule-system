export interface UserInfo {
  id: number;
  username: string;
  name: string;
  email: string | null;
  role: 'admin' | 'teacher' | 'student' | 'department_head';
  department: string | null;
  grade: string | null;
  major: string | null;
  avatar_url: string | null;
  is_active?: boolean;
  last_login: string | null;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}
