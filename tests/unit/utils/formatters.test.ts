import { describe, it, expect } from 'vitest';
import { getWeekdayName, formatSection, formatWeekInfo } from '@/utils/formatters';

describe('getWeekdayName', () => {
  it('returns correct Chinese weekday for numbers 1-7', () => {
    expect(getWeekdayName(1)).toBe('周一');
    expect(getWeekdayName(2)).toBe('周二');
    expect(getWeekdayName(3)).toBe('周三');
    expect(getWeekdayName(4)).toBe('周四');
    expect(getWeekdayName(5)).toBe('周五');
    expect(getWeekdayName(6)).toBe('周六');
    expect(getWeekdayName(7)).toBe('周日');
  });

  it('returns 时间待定 for out-of-range numbers', () => {
    expect(getWeekdayName(0)).toBe('时间待定');
    expect(getWeekdayName(8)).toBe('时间待定');
  });

  it('returns the string for string input', () => {
    expect(getWeekdayName('Monday')).toBe('Monday');
  });

  it('returns 时间待定 for null/undefined', () => {
    expect(getWeekdayName(null)).toBe('时间待定');
    expect(getWeekdayName(undefined)).toBe('时间待定');
  });
});

describe('formatSection', () => {
  it('formats array as range', () => {
    expect(formatSection([1, 2, 3])).toBe('1-3节');
  });

  it('returns empty string for empty array', () => {
    expect(formatSection([])).toBe('');
  });

  it('formats single section number', () => {
    expect(formatSection(3)).toBe('第3节');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatSection(null)).toBe('');
    expect(formatSection(undefined)).toBe('');
  });
});

describe('formatWeekInfo', () => {
  it('returns 未指定 for null/undefined', () => {
    expect(formatWeekInfo(null)).toBe('未指定');
    expect(formatWeekInfo(undefined)).toBe('未指定');
  });

  it('returns string as-is', () => {
    expect(formatWeekInfo('1-18周')).toBe('1-18周');
  });

  it('formats array as range', () => {
    expect(formatWeekInfo([1, 2, 3, 4])).toBe('1-4周');
  });

  it('formats range type', () => {
    expect(formatWeekInfo({ type: 'range', start: 1, end: 8 })).toBe('1-8周');
  });

  it('formats range with odd rule', () => {
    expect(formatWeekInfo({ type: 'range', start: 1, end: 17, rule: 'odd' })).toBe('1-17周(单周)');
  });

  it('formats range with even rule', () => {
    expect(formatWeekInfo({ type: 'range', start: 2, end: 18, rule: 'even' })).toBe('2-18周(双周)');
  });

  it('formats multi_range type', () => {
    expect(formatWeekInfo({ type: 'multi_range', ranges: [{ start: 1, end: 4 }, { start: 9, end: 12 }] }))
      .toBe('1-4,9-12周');
  });

  it('formats list type', () => {
    expect(formatWeekInfo({ type: 'list', weeks: [1, 3, 5, 7] })).toBe('第1,3,5,7周');
  });
});
