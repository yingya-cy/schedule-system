import { create } from 'zustand';
import type { UserInfo } from '@/types/auth';

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;

  login: (username: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; name: string }) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: false,
  isInitialized: false,

  login: async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || '登录失败');
    }
    const { token, user } = json.data;
    localStorage.setItem('auth_token', token);
    set({ token, user, isAuthenticated: true });
  },

  register: async (data) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || '注册失败');
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  initialize: async () => {
    const token = get().token;
    if (!token) {
      set({ isInitialized: true });
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        set({ user: json.data, isAuthenticated: true, isInitialized: true });
      } else {
        localStorage.removeItem('auth_token');
        set({ token: null, isInitialized: true });
      }
    } catch {
      localStorage.removeItem('auth_token');
      set({ token: null, isInitialized: true });
    }
  },
}));
