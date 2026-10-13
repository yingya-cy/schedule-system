import { create } from 'zustand';
import { ScheduleData, Department } from '@/types';
import { api } from '@/services/api';
import { useAuthStore } from './authStore';

interface TermOption {
  id: number;
  name: string;
  campus?: string;
  status: 'active' | 'archived';
}

interface AppState {
  // Departments
  departments: Department[];
  departmentsLoaded: boolean;
  refreshDepartments: () => Promise<void>;

  // Terms
  availableTerms: TermOption[];
  currentTermId: number | null;
  refreshTerms: () => Promise<void>;
  setCurrentTermId: (id: number) => void;

  // 【多校区】
  currentCampus: string;
  setCurrentCampus: (c: string) => void;

  // Schedules
  schedules: ScheduleData[];
  schedulesLoading: boolean;
  schedulesLoaded: boolean;
  refreshSchedules: () => Promise<void>;
  addSchedule: (schedule: ScheduleData) => void;
  updateSchedule: (schedule: ScheduleData) => void;
  removeSchedule: (id: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // 【多校区】
  currentCampus: localStorage.getItem('campus') || '河源',
  setCurrentCampus: (c: string) => {
    localStorage.setItem('campus', c);
    // 【届次联动】切校区 → 重置届次为空，再按新校区拉取
    set({ currentCampus: c, currentTermId: null });
    // 异步刷新该校区的届次列表
    void get().refreshTerms();
  },

  // Departments
  departments: [],
  departmentsLoaded: false,

  refreshDepartments: async () => {
    try {
      const data = await api.getDepartments();
      set({ departments: data, departmentsLoaded: true });
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  },

  // Terms
  availableTerms: [],
  currentTermId: null,

  refreshTerms: async () => {
    try {
      const campus = get().currentCampus;
      // 【届次联动】按当前校区过滤届次
      const res = await fetch(`/api/terms?campus=${encodeURIComponent(campus)}`, {
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
      });
      const json = await res.json();
      if (json.success) {
        const terms = json.data as TermOption[];
        set({
          availableTerms: terms,
          // 当前届次不在列表里（切了校区）→ 取该校区最新的
          currentTermId: terms.some(t => t.id === get().currentTermId)
            ? get().currentTermId
            : (terms.find(t => t.status === 'active')?.id ?? terms[0]?.id ?? null),
        });
      }
    } catch (err) {
      console.error('Failed to load terms:', err);
    }
  },

  setCurrentTermId: (id: number) => {
    set({ currentTermId: id });
    get().refreshSchedules();
  },

  // Schedules
  schedules: [],
  schedulesLoading: false,
  schedulesLoaded: false,

  refreshSchedules: async () => {
    try {
      set({ schedulesLoading: true });
      const termId = get().currentTermId;
      const data = await api.getSchedules(termId ? { term_id: termId } : {});
      set({ schedules: data, schedulesLoading: false, schedulesLoaded: true });
    } catch (err) {
      console.error('Failed to load schedules:', err);
      set({ schedulesLoading: false });
    }
  },

  addSchedule: (schedule) => {
    set((state) => ({ schedules: [schedule, ...state.schedules] }));
  },

  updateSchedule: (updatedSchedule) => {
    set((state) => ({
      schedules: state.schedules.map((s) =>
        s.id === updatedSchedule.id ? updatedSchedule : s
      ),
    }));
  },

  removeSchedule: (id) => {
    set((state) => ({
      schedules: state.schedules.filter((s) => s.id !== id),
    }));
  },
}));
