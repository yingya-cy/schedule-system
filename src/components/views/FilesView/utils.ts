import { EditableCourse, ScheduleData } from '@/types';

/**
 * Parse weekday from time string
 */
export function parseWeekday(timeStr: string): number {
  const dayMap: Record<string, number> = {
    '星期一': 1, '周一': 1, '一': 1,
    '星期二': 2, '周二': 2, '二': 2,
    '星期三': 3, '周三': 3, '三': 3,
    '星期四': 4, '周四': 4, '四': 4,
    '星期五': 5, '周五': 5, '五': 5,
    '星期六': 6, '周六': 6, '六': 6,
    '星期日': 7, '周日': 7, '日': 7, '星期天': 7
  };

  for (const [key, value] of Object.entries(dayMap)) {
    if (timeStr.includes(key)) return value;
  }
  return 1;
}

/**
 * Parse sections from time string
 */
export function parseSections(timeStr: string): number[] {
  const match = timeStr.match(/(\d+)[-~](\d+)节?/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  const singleMatch = timeStr.match(/第?(\d+)节?/);
  if (singleMatch) {
    return [parseInt(singleMatch[1])];
  }

  return [1, 2];
}

/**
 * Parse weeks from weeks string or weeksList
 */
export function parseWeeks(weeksStr: string, weeksList?: number[]): number[] {
  // Prefer backend returned weeks_list array
  if (weeksList && weeksList.length > 0) {
    return weeksList;
  }

  // If no weeks_list, parse string
  if (!weeksStr) return Array.from({ length: 18 }, (_, i) => i + 1);

  // Match single week, e.g. "4周"
  const singleMatch = weeksStr.match(/^(\d+)周$/);
  if (singleMatch) {
    return [parseInt(singleMatch[1])];
  }

  // Match week range, e.g. "1-16周"
  const match = weeksStr.match(/(\d+)[-~](\d+)/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  // Match multiple weeks, e.g. "1周,3周,5周" or "1,3,5周"
  const multiMatch = weeksStr.match(/(\d+)[,，]/g);
  if (multiMatch) {
    const weeks = multiMatch.map(m => parseInt(m.match(/\d+/)![0]));
    // Check last number
    const lastMatch = weeksStr.match(/[,，](\d+)周?$/);
    if (lastMatch) {
      weeks.push(parseInt(lastMatch[1]));
    }
    return weeks.sort((a, b) => a - b);
  }

  return Array.from({ length: 18 }, (_, i) => i + 1);
}

/**
 * Convert file to base64 string
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Format date to locale string
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format date as relative time
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return formatDate(dateStr);
}

/**
 * Calculate stats from schedules
 */
export function calculateStats(schedules: ScheduleData[]) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  return {
    total: schedules.length,
    departmentCount: new Set(schedules.map(s => s.department)).size,
    recentCount: schedules.filter(s => new Date(s.created_at) > weekAgo).length,
    withFile: schedules.filter(s => s.filename).length
  };
}

/**
 * Calculate department stats
 */
export function calculateDepartmentStats(
  schedules: ScheduleData[],
  departments: Array<{ id: number; name: string }>
) {
  return departments
    .map(dept => ({
      name: dept.name,
      count: schedules.filter(s => s.department === dept.name).length
    }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Filter schedules by department and name
 */
export function filterSchedules(
  schedules: ScheduleData[],
  filterDepartment: string,
  searchName: string
) {
  let filtered = schedules;
  if (filterDepartment) {
    filtered = filtered.filter(s => s.department === filterDepartment);
  }
  if (searchName) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(searchName.toLowerCase())
    );
  }
  return filtered;
}

/**
 * Convert OCR result to editable courses
 */
export function ocrResultToCourses(
  ocrCourses: Array<{
    courseName: string;
    time: string;
    weeks: string;
    weeksList?: number[];
    teacher?: string;
    classroom?: string;
    remark?: string;
  }>,
  fileIndex: number
): EditableCourse[] {
  return ocrCourses.map((course, index) => ({
    id: `ocr-${fileIndex}-${index}-${Date.now()}`,
    course_name: course.courseName,
    weekday: parseWeekday(course.time),
    sections: parseSections(course.time),
    weeks: parseWeeks(course.weeks, course.weeksList),
    teacher: course.teacher || '',
    location: course.classroom || '',
    remark: course.remark || '',
    isNew: true
  }));
}
