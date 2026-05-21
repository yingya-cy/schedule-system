import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
  removeItem: vi.fn((k: string) => { delete store[k]; }),
});

describe('aiScheduleApi', () => {
  let aiScheduleApi: typeof import('../../../src/services/aiScheduleApi').aiScheduleApi;

  beforeEach(async () => {
    mockFetch.mockReset();
    // Setup auth token
    store['auth_token'] = 'test-token';
    const mod = await import('../../../src/services/aiScheduleApi');
    aiScheduleApi = mod.aiScheduleApi;
  });

  const mockSuccess = (data: unknown) => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, data }),
    });
  };

  const mockError = (error: string) => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: false, error }),
    });
  };

  describe('generatePlan', () => {
    it('sends correct payload with auth header', async () => {
      mockSuccess({ id: 1, plan: { weekly_plans: [], summary: 'test' } });

      await aiScheduleApi.generatePlan({
        courses: [{ name: 'Math', weekday: 1, sections: [1, 2], weeks: [1, 2, 3], teacher: 'T1', location: 'A1' }],
        commitments: [],
        grade: '2024级',
        major: 'CS',
        next_monday: '2026-05-25',
        model: 'deepseek-v4-pro',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/schedule-plan',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      );
    });

    it('returns id and plan on success', async () => {
      const plan = { weekly_plans: [{ week_start: '2026-05-25', daily_plans: [] }], summary: 'ok' };
      mockSuccess({ id: 42, plan });

      const result = await aiScheduleApi.generatePlan({
        courses: [], commitments: [], next_monday: '2026-05-25',
      });

      expect(result.id).toBe(42);
      expect(result.plan.summary).toBe('ok');
    });

    it('throws on API error', async () => {
      mockError('AI service unavailable');

      await expect(aiScheduleApi.generatePlan({
        courses: [], commitments: [], next_monday: '2026-05-25',
      })).rejects.toThrow('AI service unavailable');
    });
  });

  describe('getPlans', () => {
    it('returns list of plans', async () => {
      const plans = [{ id: 1, term_id: null, plan_data: { weekly_plans: [], summary: '' }, created_at: '2026-05-20' }];
      mockSuccess(plans);

      const result = await aiScheduleApi.getPlans();

      expect(result).toEqual(plans);
      expect(mockFetch).toHaveBeenCalledWith('/api/ai/schedule-plans', expect.any(Object));
    });
  });

  describe('getPlan', () => {
    it('returns single plan by id', async () => {
      const plan = { id: 5, term_id: null, plan_data: { weekly_plans: [], summary: 'detail' }, created_at: '2026-05-20' };
      mockSuccess(plan);

      const result = await aiScheduleApi.getPlan(5);

      expect(result.id).toBe(5);
      expect(mockFetch).toHaveBeenCalledWith('/api/ai/schedule-plans/5', expect.any(Object));
    });
  });

  describe('deletePlan', () => {
    it('calls DELETE on plan endpoint', async () => {
      mockSuccess(undefined);

      await aiScheduleApi.deletePlan(10);

      expect(mockFetch).toHaveBeenCalledWith('/api/ai/schedule-plans/10', expect.objectContaining({ method: 'DELETE' }));
    });
  });
});
