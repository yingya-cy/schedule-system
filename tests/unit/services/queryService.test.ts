import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('@/config/database', () => ({
  default: {
    execute: mockExecute,
    query: mockExecute,
    getConnection: vi.fn(),
  },
}));

import { QueryService } from '@/services/queryService';

describe('QueryService', () => {
  let service: QueryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QueryService();
  });

  describe('queryFreeTime', () => {
    it('returns empty array when no schedules found', async () => {
      mockExecute.mockResolvedValueOnce([[]]); // no schedules
      const result = await service.queryFreeTime({ week: 1, day: 1, section: 1 });
      expect(result).toEqual([]);
    });

    it('returns results for all schedules when all free', async () => {
      const schedules = [
        { id: 1, name: '张三', department: '主任团' },
        { id: 2, name: '李四', department: '网编部' },
      ];
      // schedules query
      mockExecute.mockResolvedValueOnce([schedules]);
      // courses query returns empty (nobody has courses)
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await service.queryFreeTime({ week: 1, day: 1, section: 1 });

      expect(result).toHaveLength(1);
      expect(result[0].free_people).toHaveLength(2);
      expect(result[0].total_count).toBe(2);
    });

    it('filters busy people correctly', async () => {
      const schedules = [
        { id: 1, name: '张三', department: '主任团' },
        { id: 2, name: '李四', department: '网编部' },
      ];
      mockExecute.mockResolvedValueOnce([schedules]);
      // 张三 has course at week=1, day=1, section=1
      mockExecute.mockResolvedValueOnce([[
        {
          schedule_id: 1,
          weekday: 1,
          sections: JSON.stringify([1, 2]),
          weeks: JSON.stringify([1, 2, 3]),
        },
      ]]);

      const result = await service.queryFreeTime({ week: 1, day: 1, section: 1 });

      expect(result[0].free_people).toHaveLength(1);
      expect(result[0].free_people[0].name).toBe('李四');
    });

    it('applies department filter', async () => {
      mockExecute.mockResolvedValueOnce([[]]); // empty because department filter
      await service.queryFreeTime({ week: 1, department: '网编部' });
      // Verify SQL includes department condition
      const sqlCall = mockExecute.mock.calls[0][0] as string;
      expect(sqlCall).toContain('department');
    });

    it('queries all weeks/days/sections when not specified', async () => {
      const schedules = [{ id: 1, name: '测试', department: '主任团' }];
      mockExecute.mockResolvedValueOnce([schedules]);
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await service.queryFreeTime({});

      // 18 weeks * 7 days * 11 sections = 1386
      expect(result).toHaveLength(1386);
    });
  });

  describe('getPersonSchedule', () => {
    it('returns null when person not found', async () => {
      mockExecute.mockResolvedValueOnce([[]]); // no schedule
      const result = await service.getPersonSchedule('不存在');
      expect(result).toBeNull();
    });

    it('returns schedule with courses', async () => {
      const schedule = { id: 1, name: '张三', department: '主任团' };
      const courses = [{ id: 1, schedule_id: 1, course_name: '数学', weekday: 1, sections: [1, 2], weeks: [1, 2, 3] }];

      mockExecute.mockResolvedValueOnce([[schedule]]);
      mockExecute.mockResolvedValueOnce([courses]);

      const result = await service.getPersonSchedule('张三');

      expect(result).not.toBeNull();
      expect(result!.schedule.name).toBe('张三');
      expect(result!.all_courses).toHaveLength(1);
    });
  });

  describe('getDepartmentStats', () => {
    it('returns department summary with people count', async () => {
      const schedules = [
        { id: 1, name: '张三', department: '主任团' },
        { id: 2, name: '李四', department: '主任团' },
      ];
      mockExecute.mockResolvedValueOnce([schedules]);

      const result = await service.getDepartmentStats('主任团');

      expect(result.department).toBe('主任团');
      expect(result.total_people).toBe(2);
    });
  });

  describe('getAllFreeTimeData', () => {
    it('returns empty matrix when no schedules exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await service.getAllFreeTimeData();

      expect(result.total_schedules).toBe(0);
    });

    it('builds correct data for one schedule', async () => {
      const rows = [
        {
          schedule_id: 1,
          name: '张三',
          weekday: 1,
          sections: JSON.stringify([1, 2]),
          weeks: JSON.stringify([1, 2]),
        },
      ];
      mockExecute.mockResolvedValueOnce([rows]);

      const result = await service.getAllFreeTimeData();

      expect(result.total_schedules).toBe(1);
      expect(result.departments).toBeDefined();
      expect(result.people).toHaveLength(1);
    });
  });
});
