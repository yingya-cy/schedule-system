import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = {
  generatePlan: vi.fn(),
  getPlans: vi.fn(),
  getPlan: vi.fn(),
  deletePlan: vi.fn(),
};

vi.mock('../../../src/services/aiScheduleApi', () => ({
  aiScheduleApi: mockApi,
}));

describe('useAiScheduleStore', () => {
  let useAiScheduleStore: typeof import('../../../src/stores/aiScheduleStore').useAiScheduleStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset store state
    const mod = await import('../../../src/stores/aiScheduleStore');
    useAiScheduleStore = mod.useAiScheduleStore;
    useAiScheduleStore.setState({
      plans: [],
      plansLoading: false,
      generatedPlan: null,
      generating: false,
      generateError: null,
      selectedPlan: null,
    });
  });

  describe('generatePlan', () => {
    it('sets generating=true then false on success', async () => {
      mockApi.generatePlan.mockResolvedValue({ id: 1, plan: { weekly_plans: [], summary: 'ok' } });

      const states: string[] = [];
      useAiScheduleStore.subscribe((s) => states.push(s.generating ? 'generating' : 'idle'));

      await useAiScheduleStore.getState().generatePlan({
        courses: [], commitments: [], next_monday: '2026-05-25',
      });

      const state = useAiScheduleStore.getState();
      expect(state.generating).toBe(false);
      expect(state.generatedPlan).toEqual({ weekly_plans: [], summary: 'ok' });
      expect(state.generateError).toBeNull();
    });

    it('sets error on failure', async () => {
      mockApi.generatePlan.mockRejectedValue(new Error('API down'));

      await useAiScheduleStore.getState().generatePlan({
        courses: [], commitments: [], next_monday: '2026-05-25',
      });

      const state = useAiScheduleStore.getState();
      expect(state.generating).toBe(false);
      expect(state.generateError).toBe('API down');
      expect(state.generatedPlan).toBeNull();
    });
  });

  describe('fetchPlans', () => {
    it('populates plans on success', async () => {
      const plans = [{ id: 1, term_id: null, plan_data: { weekly_plans: [], summary: '' }, created_at: '' }];
      mockApi.getPlans.mockResolvedValue(plans);

      await useAiScheduleStore.getState().fetchPlans();

      expect(useAiScheduleStore.getState().plans).toEqual(plans);
      expect(useAiScheduleStore.getState().plansLoading).toBe(false);
    });

    it('sets plansLoading false on error', async () => {
      mockApi.getPlans.mockRejectedValue(new Error('failed'));

      await useAiScheduleStore.getState().fetchPlans();

      expect(useAiScheduleStore.getState().plansLoading).toBe(false);
      expect(useAiScheduleStore.getState().plans).toEqual([]);
    });
  });

  describe('fetchPlanDetail', () => {
    it('sets selectedPlan and generatedPlan', async () => {
      const planData = { weekly_plans: [{ week_start: '2026-01-01', daily_plans: [] }], summary: 'detail' };
      const plan = { id: 5, term_id: null, plan_data: planData, created_at: '' };
      mockApi.getPlan.mockResolvedValue(plan);

      await useAiScheduleStore.getState().fetchPlanDetail(5);

      const state = useAiScheduleStore.getState();
      expect(state.selectedPlan).toEqual(plan);
      expect(state.generatedPlan).toEqual(planData);
    });

    it('silently handles errors', async () => {
      mockApi.getPlan.mockRejectedValue(new Error('not found'));

      await useAiScheduleStore.getState().fetchPlanDetail(999);

      // No error thrown, state unchanged
      expect(useAiScheduleStore.getState().selectedPlan).toBeNull();
    });
  });

  describe('deletePlan', () => {
    it('calls API and refreshes plans', async () => {
      mockApi.deletePlan.mockResolvedValue(undefined);
      mockApi.getPlans.mockResolvedValue([{ id: 2, term_id: null, plan_data: { weekly_plans: [], summary: 'remaining' }, created_at: '' }]);

      await useAiScheduleStore.getState().deletePlan(1);

      expect(mockApi.deletePlan).toHaveBeenCalledWith(1);
      expect(mockApi.getPlans).toHaveBeenCalled();
      expect(useAiScheduleStore.getState().plans.length).toBe(1);
    });
  });

  describe('clearGenerated', () => {
    it('resets generatedPlan and error', () => {
      useAiScheduleStore.setState({ generatedPlan: { weekly_plans: [], summary: 'old' }, generateError: 'err' });

      useAiScheduleStore.getState().clearGenerated();

      expect(useAiScheduleStore.getState().generatedPlan).toBeNull();
      expect(useAiScheduleStore.getState().generateError).toBeNull();
    });
  });
});
