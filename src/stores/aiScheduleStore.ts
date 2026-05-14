import { create } from 'zustand';
import type { PlanData, SchedulePlan } from '../services/aiScheduleApi';
import { aiScheduleApi } from '../services/aiScheduleApi';

interface AiScheduleState {
  // History
  plans: SchedulePlan[];
  plansLoading: boolean;
  fetchPlans: () => Promise<void>;

  // Current generation
  generatedPlan: PlanData | null;
  generating: boolean;
  generateError: string | null;
  generatePlan: (data: {
    courses: unknown[];
    commitments: unknown[];
    grade?: string;
    major?: string;
    next_monday: string;
    term_id?: number;
  }) => Promise<number | null>;

  // Selected plan (for viewing history)
  selectedPlan: SchedulePlan | null;
  fetchPlanDetail: (id: number) => Promise<void>;

  deletePlan: (id: number) => Promise<void>;
  clearGenerated: () => void;
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : '未知错误';
}

export const useAiScheduleStore = create<AiScheduleState>((set, get) => ({
  plans: [],
  plansLoading: false,

  fetchPlans: async () => {
    set({ plansLoading: true });
    try {
      const data = await aiScheduleApi.getPlans();
      set({ plans: data, plansLoading: false });
    } catch {
      set({ plansLoading: false });
    }
  },

  generatedPlan: null,
  generating: false,
  generateError: null,

  generatePlan: async (data) => {
    set({ generating: true, generateError: null });
    try {
      const result = await aiScheduleApi.generatePlan(data);
      set({ generatedPlan: result.plan, generating: false });
      return result.id;
    } catch (e) {
      set({ generating: false, generateError: getErrorMessage(e) });
      return null;
    }
  },

  selectedPlan: null,

  fetchPlanDetail: async (id) => {
    try {
      const data = await aiScheduleApi.getPlan(id);
      set({ selectedPlan: data, generatedPlan: data.plan_data });
    } catch {
      // ignore
    }
  },

  deletePlan: async (id) => {
    await aiScheduleApi.deletePlan(id);
    await get().fetchPlans();
  },

  clearGenerated: () => set({ generatedPlan: null, generateError: null }),
}));
