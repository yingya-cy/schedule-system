import { create } from 'zustand';
import { ScheduleData, Department } from '@/types';
import { api } from '@/services/api';

interface AppState {
  // Departments
  departments: Department[];
  departmentsLoaded: boolean;
  refreshDepartments: () => Promise<void>;

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

  // Schedules
  schedules: [],
  schedulesLoading: false,
  schedulesLoaded: false,

  refreshSchedules: async () => {
    try {
      set({ schedulesLoading: true });
      const data = await api.getSchedules({});
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

