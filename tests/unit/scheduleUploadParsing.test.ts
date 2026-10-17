import { describe, expect, it } from 'vitest';
import { mapBackendDataToArray, parsePeriod } from '../../src/utils/dataMappers';
import { assertValidCourseSections, parseSections, parseWeeks } from '../../src/components/views/FilesView/utils';

describe('schedule upload period parsing', () => {
  it('keeps a valid class period', () => {
    expect(parsePeriod('9-11节')).toEqual([9, 10, 11]);
    expect(parseSections('星期二 9-11节')).toEqual([9, 10, 11]);
  });

  it('does not use a course title year range as class sections', () => {
    expect(parsePeriod('1919-1949')).toEqual([]);
    expect(parseSections('星期二 1919-1949')).toEqual([]);
  });

  it('preserves the existing other-course fallback', () => {
    expect(parseSections('其他 其他时间')).toEqual([1, 2]);
  });

  it('rejects a file result containing an invalid class period', () => {
    expect(() => assertValidCourseSections([{ sections: [1, 2] }, { sections: [] }]))
      .toThrow('识别到无效节次');
    expect(() => assertValidCourseSections([{ sections: parseSections('其他 其他时间') }]))
      .not.toThrow();
  });

  it('does not hide an invalid backend period before upload validation', () => {
    const [course] = mapBackendDataToArray([
      { course_name: '测试课', weekday: 2, period: '1919-1949节', weeks: '6-16周' },
    ]);
    expect(parseSections(course.time)).toEqual([]);
  });

  it('preserves sparse week arrays returned by the horizontal PDF parser', () => {
    const [oddWeekCourse, splitRangeCourse] = mapBackendDataToArray([
      { course_name: '电路I (下)', weekday: 2, section: '1-2', weeks: [7, 9, 11, 13] },
      { course_name: '马克思主义基本原理', weekday: 4, section: '1-3', weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16] },
    ]);
    expect(oddWeekCourse.weeks).toBe('7,9,11,13周');
    expect(parseWeeks(oddWeekCourse.weeks, oddWeekCourse.weeksList)).toEqual([7, 9, 11, 13]);
    expect(splitRangeCourse.weeks).toBe('1-12,15-16周');
    expect(parseWeeks(splitRangeCourse.weeks, splitRangeCourse.weeksList)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16]);
  });
});
