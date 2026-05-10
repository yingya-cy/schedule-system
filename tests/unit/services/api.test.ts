import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
  removeItem: vi.fn((k: string) => { delete store[k]; }),
});

describe('api', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    mockFetch.mockReset();
  });

  describe('getDepartments', () => {
    it('returns data on success', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: [{ id: 1, name: '网编部' }] }) });
      const depts = await api.getDepartments();
      expect(depts).toHaveLength(1);
      expect(depts[0].name).toBe('网编部');
    });
    it('throws on failure', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: false, error: 'fail' }) });
      await expect(api.getDepartments()).rejects.toThrow('fail');
    });
  });

  describe('getSchedules', () => {
    it('returns data on success', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: [{ id: 1, name: 'S1' }] }) });
      const schedules = await api.getSchedules({ department: '网编部' });
      expect(schedules).toHaveLength(1);
    });
    it('sends auth header when token exists', async () => {
      store['auth_token'] = 'test-token';
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: [] }) });
      await api.getSchedules();
      const call = mockFetch.mock.calls[0];
      expect(call[1]?.headers?.Authorization).toBe('Bearer test-token');
    });
    it('throws on failure', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: false, error: 'err' }) });
      await expect(api.getSchedules()).rejects.toThrow('err');
    });
  });

  describe('getSchedule', () => {
    it('returns schedule by id', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: { id: 5, name: 'S5' } }) });
      const s = await api.getSchedule(5);
      expect(s.id).toBe(5);
    });
  });

  describe('createSchedule', () => {
    it('posts and returns created schedule', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: { id: 10 } }) });
      const s = await api.createSchedule({ name: 'New', department: '网编部', courses: [] });
      expect(s.id).toBe(10);
    });
  });

  describe('updateSchedule', () => {
    it('puts and returns updated schedule', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: { id: 3, name: 'Updated' } }) });
      const s = await api.updateSchedule(3, { name: 'Updated' });
      expect(s.name).toBe('Updated');
    });
  });

  describe('deleteSchedule', () => {
    it('deletes and returns true', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true }) });
      const r = await api.deleteSchedule(1);
      expect(r).toBe(true);
    });
  });

  describe('createCourse', () => {
    it('creates course', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: { id: 1, course_name: '数学' } }) });
      const c = await api.createCourse(1, { course_name: '数学', weekday: 1, sections: [1,2], weeks: [1] });
      expect(c.course_name).toBe('数学');
    });
  });

  describe('updateCourse', () => {
    it('updates course', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: { id: 1, course_name: '更新' } }) });
      const c = await api.updateCourse(1, { course_name: '更新' });
      expect(c.course_name).toBe('更新');
    });
  });

  describe('deleteCourse', () => {
    it('deletes course', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true }) });
      const r = await api.deleteCourse(1);
      expect(r).toBe(true);
    });
  });

  describe('queryFreeTime', () => {
    it('returns free time results', async () => {
      const { api } = await import('../../../src/services/api.ts');
      mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ success: true, data: [] }) });
      const r = await api.queryFreeTime({ week: 1 });
      expect(r).toEqual([]);
    });
  });

  describe('getFileUrl', () => {
    it('includes token param when authenticated', async () => {
      store['auth_token'] = 'my-token';
      const { api } = await import('../../../src/services/api.ts');
      const url = api.getScheduleFileUrl(1, true);
      expect(url).toContain('token=my-token');
    });
  });
});
