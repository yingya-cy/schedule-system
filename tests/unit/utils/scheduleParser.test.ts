import { describe, it, expect } from 'vitest';
import {
  parseWeekday,
  parseSections,
  parseWeeks,
  formatSections,
  formatWeeks,
  mergeWeekRanges,
} from '../../../src/utils/scheduleParser.ts';

describe('parseWeekday', () => {
  it('parses 周一 as 1', () => { expect(parseWeekday('周一')).toBe(1); });
  it('parses 星期二 as 2', () => { expect(parseWeekday('星期二')).toBe(2); });
  it('parses 三 as 3', () => { expect(parseWeekday('三')).toBe(3); });
  it('parses 星期日 as 7', () => { expect(parseWeekday('星期日')).toBe(7); });
  it('parses Monday as 1', () => { expect(parseWeekday('Monday')).toBe(1); });
  it('returns null for unknown', () => { expect(parseWeekday('未知')).toBeNull(); });
});

describe('parseSections', () => {
  it('parses "第1-2节" as [1,2]', () => { expect(parseSections('第1-2节')).toEqual([1, 2]); });
  it('parses "第5节" as [5]', () => { expect(parseSections('第5节')).toEqual([5]); });
  it('parses "3-4" as [3,4]', () => { expect(parseSections('3-4')).toEqual([3, 4]); });
  it('extracts numbers as fallback', () => { expect(parseSections('7 8')).toEqual([7, 8]); });
  it('returns empty for no match', () => { expect(parseSections('无')).toEqual([]); });
  it('deduplicates and sorts', () => { expect(parseSections('3-1')).toEqual([1, 3]); });
});

describe('parseWeeks', () => {
  it('parses "1-3" as [1,2,3]', () => { expect(parseWeeks('1-3')).toEqual([1, 2, 3]); });
  it('parses single "5" as [5]', () => { expect(parseWeeks('5')).toEqual([5]); });
  it('deduplicates', () => { expect(parseWeeks('1-3 2-4')).toEqual([1, 2, 3, 4]); });
});

describe('formatSections', () => {
  it('formats single section', () => { expect(formatSections([3])).toBe('第3节'); });
  it('formats range', () => { expect(formatSections([1, 2])).toBe('第1-2节'); });
  it('returns empty for empty', () => { expect(formatSections([])).toBe(''); });
});

describe('formatWeeks', () => {
  it('formats single week', () => { expect(formatWeeks([3])).toBe('第3周'); });
  it('formats range', () => { expect(formatWeeks([1, 2, 3])).toBe('第1-3周'); });
  it('formats non-contiguous', () => { expect(formatWeeks([1, 3, 5])).toBe('第1周, 第3周, 第5周'); });
  it('returns 全学期 for full', () => { expect(formatWeeks([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20])).toBe('全学期'); });
});

describe('mergeWeekRanges', () => {
  it('merges contiguous weeks', () => { expect(mergeWeekRanges([1, 2, 4])).toEqual([2, 4]); });
  it('returns single unchanged', () => { expect(mergeWeekRanges([5])).toEqual([5]); });
  it('returns empty for empty', () => { expect(mergeWeekRanges([])).toEqual([]); });
});
