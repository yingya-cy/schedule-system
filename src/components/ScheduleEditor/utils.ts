import { EditableCourse, COURSE_COLORS } from '@/types';
import { WeekRange } from './constants';

/**
 * Get course color by index
 */
export function getCourseColor(index: number): string {
  return COURSE_COLORS[index % COURSE_COLORS.length];
}

/**
 * Format weeks array to display string
 */
export function formatWeeksDisplay(weeks: number[]): string {
  if (!weeks || weeks.length === 0) return '未设置';

  const sorted = [...weeks].sort((a, b) => a - b);
  const ranges: { start: number; end: number; isOdd?: boolean; isEven?: boolean }[] = [];

  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    let end = start;

    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) {
      i++;
      end = sorted[i];
    }

    const rangeWeeks = sorted.filter(w => w >= start && w <= end);
    const isOdd = rangeWeeks.every(w => w % 2 === 1) && rangeWeeks.length > 1;
    const isEven = rangeWeeks.every(w => w % 2 === 0) && rangeWeeks.length > 1;

    ranges.push({ start, end, isOdd, isEven });
    i++;
  }

  return ranges.map(r => {
    let str = r.start === r.end ? `${r.start}周` : `${r.start}-${r.end}周`;
    if (r.isOdd) str += '(单)';
    if (r.isEven) str += '(双)';
    return str;
  }).join(',');
}

/**
 * Parse week ranges to weeks array
 */
export function parseWeeksFromRanges(ranges: WeekRange[]): number[] {
  const weeks = new Set<number>();

  for (const range of ranges) {
    if (range.start === null || range.end === null) continue;

    const start = range.start;
    const end = range.end;

    if (range.type === 'odd') {
      for (let w = start; w <= end; w += 2) {
        if (w % 2 === 1) weeks.add(w);
      }
    } else if (range.type === 'even') {
      for (let w = start; w <= end; w += 2) {
        if (w % 2 === 0) weeks.add(w);
      }
    } else {
      for (let w = start; w <= end; w++) {
        weeks.add(w);
      }
    }
  }

  return Array.from(weeks).sort((a, b) => a - b);
}

/**
 * Convert weeks array to week ranges
 */
export function weeksToRanges(weeks: number[]): WeekRange[] {
  if (!weeks || weeks.length === 0) return [];

  const sorted = [...weeks].sort((a, b) => a - b);
  const ranges: WeekRange[] = [];

  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    let end = start;

    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) {
      i++;
      end = sorted[i];
    }

    const rangeWeeks = sorted.filter(w => w >= start && w <= end);
    const isOdd = rangeWeeks.every(w => w % 2 === 1) && rangeWeeks.length > 1;
    const isEven = rangeWeeks.every(w => w % 2 === 0) && rangeWeeks.length > 1;

    ranges.push({
      id: `range-${Date.now()}-${Math.random()}`,
      start,
      end,
      type: isOdd ? 'odd' : isEven ? 'even' : 'all'
    });

    i++;
  }

  return ranges;
}

/**
 * Parse section input string to sections array
 */
export function parseSectionInput(input: string): number[] {
  const match = input.match(/(\d+)\s*[-~]\s*(\d+)/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  const singleMatch = input.match(/(\d+)/);
  if (singleMatch) {
    return [parseInt(singleMatch[1])];
  }
  return [];
}
