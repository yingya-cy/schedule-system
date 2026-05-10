import { WEEKDAYS } from '@/types';

export function getWeekdayName(day: number | string | null | undefined): string {
  if (typeof day === 'number') {
    return WEEKDAYS[day - 1] || '时间待定';
  }
  return day || '时间待定';
}

export function formatSection(section: number[] | number | null | undefined): string {
  if (Array.isArray(section)) {
    if (section.length === 0) return '';
    return `${section[0]}-${section[section.length - 1]}节`;
  }
  if (typeof section === 'number') {
    return `第${section}节`;
  }
  return '';
}

interface WeekRange {
  start: number;
  end: number;
  rule?: 'odd' | 'even';
}

interface MultiRangeWeek {
  type: 'multi_range';
  ranges: WeekRange[];
}

interface ListWeek {
  type: 'list';
  weeks: number[];
}

interface RangeWeek {
  type: 'range';
  start: number;
  end: number;
  rule?: 'odd' | 'even';
}

type WeekInput = string | number[] | MultiRangeWeek | ListWeek | RangeWeek | null | undefined;

export function formatWeekInfo(week: WeekInput): string {
  if (!week) return '未指定';
  if (typeof week === 'string') {
    return week;
  }
  if (Array.isArray(week) && week.length > 0) {
    return `${week[0]}-${week[week.length - 1]}周`;
  }
  if (typeof week === 'object' && 'type' in week) {
    if (week.type === 'range') {
      const w = week as RangeWeek;
      let suffix = '';
      if (w.rule === 'odd') suffix = '(单周)';
      if (w.rule === 'even') suffix = '(双周)';
      return `${w.start}-${w.end}周${suffix}`;
    }
    if (week.type === 'multi_range' && 'ranges' in week) {
      const w = week as MultiRangeWeek;
      return w.ranges.map((r) => `${r.start}-${r.end}`).join(',') + '周';
    }
    if (week.type === 'list' && 'weeks' in week) {
      const w = week as ListWeek;
      return `第${w.weeks.join(',')}周`;
    }
  }
  return JSON.stringify(week);
}

export function columnLetter(col: number): string {
  let s = '';
  while (col > 0) {
    s = String.fromCharCode(65 + ((col - 1) % 26)) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
