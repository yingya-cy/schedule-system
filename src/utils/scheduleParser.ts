/**
 * 课表解析工具函数
 */

import { WEEK_COUNT } from '@/types';

/**
 * 解析星期几
 */
export function parseWeekday(text: string): number | null {
  const dayMap: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7,
    '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7,
    '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 7,
    'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7,
  };
  const lower = text.toLowerCase().trim();
  for (const [key, value] of Object.entries(dayMap)) {
    if (lower.includes(key.toLowerCase())) return value;
  }
  return null;
}

/**
 * 解析节次
 */
export function parseSections(text: string): number[] {
  const sections: number[] = [];
  const patterns = [
    /第(\d+)[-~](\d+)节/,
    /(\d+)[-~](\d+)/,
    /第(\d+)节/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match.length === 3) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        for (let i = start; i <= end; i++) sections.push(i);
      } else if (match.length === 2) {
        sections.push(parseInt(match[1]));
      }
      break;
    }
  }

  if (sections.length === 0) {
    const nums = text.match(/\d+/g);
    if (nums) {
      for (const num of nums) {
        const n = parseInt(num);
        if (n >= 1 && n <= 11 && !sections.includes(n)) sections.push(n);
      }
    }
  }

  return [...new Set(sections)].sort((a, b) => a - b);
}

/**
 * 解析周次
 */
export function parseWeeks(text: string): number[] {
  const weeks: number[] = [];
  const rangePattern = /(\d+)[-~](\d+)/g;
  const singlePattern = /(\d+)/g;
  let match;

  while ((match = rangePattern.exec(text)) !== null) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    for (let i = start; i <= end; i++) weeks.push(i);
  }

  while ((match = singlePattern.exec(text)) !== null) {
    const n = parseInt(match[1]);
    if (n >= 1 && n <= WEEK_COUNT && !weeks.includes(n)) weeks.push(n);
  }

  return [...new Set(weeks)].sort((a, b) => a - b);
}

/**
 * 星期名称
 */
export const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * 将节次数组转为显示字符串
 */
export function formatSections(sections: number[]): string {
  if (sections.length === 0) return '';
  if (sections.length === 1) return `第${sections[0]}节`;
  return `第${sections[0]}-${sections[sections.length - 1]}节`;
}

/**
 * 将周次数组转为显示字符串（合并连续周）
 */
export function formatWeeks(weeks: number[]): string {
  if (weeks.length === 0) return '';
  if (weeks.length === 1) return `第${weeks[0]}周`;
  if (weeks.length === WEEK_COUNT) return '全学期';

  const ranges: string[] = [];
  let start = weeks[0];
  let end = weeks[0];

  for (let i = 1; i <= weeks.length; i++) {
    if (i < weeks.length && weeks[i] === end + 1) {
      end = weeks[i];
    } else {
      ranges.push(start === end ? `第${start}周` : `第${start}-${end}周`);
      if (i < weeks.length) {
        start = end = weeks[i];
      }
    }
  }

  return ranges.join(', ');
}

/**
 * 合并周次范围
 */
export function mergeWeekRanges(weeks: number[]): number[] {
  if (weeks.length <= 1) return weeks;
  const sorted = [...weeks].sort((a, b) => a - b);
  const merged: number[] = [sorted[0]];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === current + 1) {
      current = sorted[i];
      merged[merged.length - 1] = current;
    } else if (sorted[i] !== current) {
      merged.push(sorted[i]);
      current = sorted[i];
    }
  }

  return merged;
}
