import { describe, it, expect } from 'vitest';
import { parsePeriod, mapBackendDataToArray, mapFrontendDataToArray } from '@/utils/dataMappers';
import type { BackendCourseData, CourseRecord } from '@/types';

describe('parsePeriod', () => {
  it('returns array as-is', () => {
    expect(parsePeriod([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('parses dash-separated range', () => {
    expect(parsePeriod('1-3节')).toEqual([1, 2, 3]);
  });

  it('parses tilde-separated range', () => {
    expect(parsePeriod('5~7节')).toEqual([5, 6, 7]);
  });

  it('parses single section', () => {
    expect(parsePeriod('第3节')).toEqual([3]);
  });

  it('parses bare number string', () => {
    expect(parsePeriod('第3节')).toEqual([3]);
  });

  it('returns empty array for null/undefined/empty', () => {
    expect(parsePeriod(null)).toEqual([]);
    expect(parsePeriod(undefined)).toEqual([]);
    expect(parsePeriod('')).toEqual([]);
  });
});

describe('mapBackendDataToArray', () => {
  it('maps backend course data to unified format', () => {
    const input: BackendCourseData[] = [
      {
        course_name: '高等数学',
        weekday: 1,
        section: '1-2节',
        week: '1-4周',
        teacher: '李教授',
        location: '教学楼302',
      },
    ];

    const result = mapBackendDataToArray(input);
    expect(result).toHaveLength(1);
    expect(result[0].courseName).toBe('高等数学');
    expect(result[0].time).toContain('周一');
    expect(result[0].teacher).toBe('李教授');
    expect(result[0].classroom).toBe('教学楼302');
  });

  it('handles string section input', () => {
    const input: BackendCourseData[] = [
      {
        course_name: '测试课',
        weekday: 3,
        section: '1-2节',
      },
    ];
    const result = mapBackendDataToArray(input);
    expect(result[0].courseName).toBe('测试课');
    expect(result[0].time).toContain('周三');
    expect(result[0].time).toContain('1-2节');
  });

  it('handles missing fields gracefully', () => {
    const input: BackendCourseData[] = [{}];
    const result = mapBackendDataToArray(input);
    expect(result[0].courseName).toBe('未知课程');
    expect(result[0].teacher).toBe('');
    expect(result[0].classroom).toBe('');
  });

  it('handles empty array', () => {
    expect(mapBackendDataToArray([])).toEqual([]);
  });

  it('keeps military practice so availability rules can mark its weeks unavailable', () => {
    const input: BackendCourseData[] = [
      {
        course_name: '军事实践',
        weekday: 1,
        section: '1-2节',
        weeks_list: [13, 14],
      },
      {
        course_name: '实践课程：军事实践■古浩嵩(共2周)/13-14周',
        weekday: 1,
        section: '1-2节',
        weeks_list: [13, 14],
      },
      {
        course_name: '高等数学',
        weekday: 2,
        section: '3-4节',
        weeks_list: [1, 2],
      },
    ];

    expect(mapBackendDataToArray(input)).toEqual(expect.arrayContaining([
      expect.objectContaining({ courseName: '军事实践', weeksList: [13, 14] }),
      expect.objectContaining({ courseName: '实践课程：军事实践■古浩嵩(共2周)/13-14周', weeksList: [13, 14] }),
      expect.objectContaining({ courseName: '高等数学' }),
    ]));
    expect(mapBackendDataToArray(input)).toHaveLength(3);
  });
});

describe('mapFrontendDataToArray', () => {
  it('maps frontend course records', () => {
    const input: CourseRecord[] = [
      {
        id: '1',
        courseName: '物理实验',
        dayOfWeek: '周三',
        sessionRaw: '5-7节',
        weeks: [1, 2, 3, 4, 5, 6, 7, 8],
        teacher: '张教授',
        location: '实验室A',
      },
    ];
    const result = mapFrontendDataToArray(input);
    expect(result[0].courseName).toBe('物理实验');
    expect(result[0].time).toBe('周三 5-7节');
    expect(result[0].weeks).toBe('1-8周');
  });
});
