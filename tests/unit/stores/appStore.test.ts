import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before module load (vi.hoisted runs first)
vi.hoisted(() => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  } as any;
});

// Test the store logic by importing the factory
// We mock the api module so no real HTTP calls are made
vi.mock('@/services/api', () => ({
  api: {
    getDepartments: vi.fn().mockResolvedValue([
      { id: 1, name: '主任团' },
    ]),
    getSchedules: vi.fn().mockResolvedValue([
      { id: 1, name: '测试课表', department: '主任团' },
    ]),
  },
}));

import { useAppStore } from '@/stores/appStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      departments: [],
      departmentsLoaded: false,
      schedules: [],
      schedulesLoading: false,
      schedulesLoaded: false,
    });
  });

  describe('initial state', () => {
    it('has empty departments array', () => {
      const state = useAppStore.getState();
      expect(state.departments).toEqual([]);
    });

    it('has departmentsLoaded = false', () => {
      const state = useAppStore.getState();
      expect(state.departmentsLoaded).toBe(false);
    });

    it('has empty schedules array', () => {
      const state = useAppStore.getState();
      expect(state.schedules).toEqual([]);
    });

    it('has schedulesLoading = false', () => {
      const state = useAppStore.getState();
      expect(state.schedulesLoading).toBe(false);
    });
  });

  describe('addSchedule', () => {
    it('adds schedule to the beginning of the array', () => {
      const schedule1 = { id: 1, name: 'A', department: 'X' } as any;
      const schedule2 = { id: 2, name: 'B', department: 'Y' } as any;

      useAppStore.getState().addSchedule(schedule1);
      useAppStore.getState().addSchedule(schedule2);

      const state = useAppStore.getState();
      expect(state.schedules).toHaveLength(2);
      expect(state.schedules[0].id).toBe(2);
    });
  });

  describe('updateSchedule', () => {
    it('updates matching schedule by id', () => {
      const schedule = { id: 1, name: 'Original', department: 'X' } as any;
      useAppStore.getState().addSchedule(schedule);

      useAppStore.getState().updateSchedule({ id: 1, name: 'Updated', department: 'X' } as any);

      const state = useAppStore.getState();
      expect(state.schedules[0].name).toBe('Updated');
    });

    it('does not modify other schedules', () => {
      const s1 = { id: 1, name: 'A', department: 'X' } as any;
      const s2 = { id: 2, name: 'B', department: 'Y' } as any;
      useAppStore.getState().addSchedule(s1);
      useAppStore.getState().addSchedule(s2);

      useAppStore.getState().updateSchedule({ id: 1, name: 'AUpdated', department: 'X' } as any);

      const state = useAppStore.getState();
      expect(state.schedules.find(s => s.id === 2)?.name).toBe('B');
    });
  });

  describe('removeSchedule', () => {
    it('removes schedule by id', () => {
      const s1 = { id: 1, name: 'A', department: 'X' } as any;
      const s2 = { id: 2, name: 'B', department: 'Y' } as any;
      useAppStore.getState().addSchedule(s1);
      useAppStore.getState().addSchedule(s2);

      useAppStore.getState().removeSchedule(1);

      const state = useAppStore.getState();
      expect(state.schedules).toHaveLength(1);
      expect(state.schedules[0].id).toBe(2);
    });

    it('does nothing when id does not exist', () => {
      useAppStore.getState().removeSchedule(999);
      expect(useAppStore.getState().schedules).toHaveLength(0);
    });
  });

  describe('refreshDepartments', () => {
    it('sets departmentsLoaded to true after fetch', async () => {
      await useAppStore.getState().refreshDepartments();
      const state = useAppStore.getState();
      expect(state.departmentsLoaded).toBe(true);
      expect(state.departments.length).toBeGreaterThan(0);
    });
  });

  describe('refreshSchedules', () => {
    it('sets schedulesLoaded to true after fetch', async () => {
      await useAppStore.getState().refreshSchedules();
      const state = useAppStore.getState();
      expect(state.schedulesLoaded).toBe(true);
      expect(state.schedules.length).toBeGreaterThan(0);
    });

    it('sets schedulesLoading=false even on failure', async () => {
      const { api } = await import('@/services/api');
      (api.getSchedules as any).mockRejectedValueOnce(new Error('fail'));
      await useAppStore.getState().refreshSchedules();
      expect(useAppStore.getState().schedulesLoading).toBe(false);
      (api.getSchedules as any).mockResolvedValue([{ id: 1, name: 'S1', department: 'X' }]);
    });
  });

  describe('refreshDepartments failure', () => {
    it('does not crash when fetch fails', async () => {
      const { api } = await import('@/services/api');
      (api.getDepartments as any).mockRejectedValueOnce(new Error('network error'));
      await useAppStore.getState().refreshDepartments();
      expect(useAppStore.getState().departmentsLoaded).toBe(false);
      (api.getDepartments as any).mockResolvedValue([{ id: 1, name: '网编部' }]);
    });
  });

  describe('setCurrentTermId', () => {
    it('updates term id', () => {
      useAppStore.getState().setCurrentTermId(5);
      expect(useAppStore.getState().currentTermId).toBe(5);
    });
  });

  describe('terms', () => {
    it('refreshTerms populates availableTerms', async () => {
      useAppStore.setState({ currentTermId: null });
      const mockResolve = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: [{ id: 1, name: '2024秋', status: 'active' }] }),
      });
      vi.stubGlobal('fetch', mockResolve);
      const { useAuthStore } = await import('@/stores/authStore');
      useAuthStore.setState({ token: 'test-token' });

      await useAppStore.getState().refreshTerms();
      const state = useAppStore.getState();
      expect(state.availableTerms.length).toBeGreaterThan(0);
      expect(state.currentTermId).toBe(1);

      vi.unstubAllGlobals();
    });
  });
});
