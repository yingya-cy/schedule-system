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
    if (start < 1 || end < start || end > 24) return [];
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  const singleMatch = timeStr.match(/第?(\d+)节/);
  if (singleMatch) {
    const sectionNumber = parseInt(singleMatch[1]);
    return sectionNumber >= 1 && sectionNumber <= 24 ? [sectionNumber] : [];
  }

  return [1, 2];
}

export function assertValidCourseSections(courses: ReadonlyArray<{ sections: number[] }>): void {
  if (courses.some(course => course.sections.length === 0)) {
    throw new Error('识别到无效节次，请检查课表后重新上传');
  }
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
  // 【修复】解析失败不再兜底填满 18 周（会掩盖真问题、产生假数据）；
  // 返回空数组，下游 formatWeeks([]) 会显示为空
  if (!weeksStr) return [];

  // Match single week, e.g. "4周"
  const singleMatch = weeksStr.match(/^(\d+)周$/);
  if (singleMatch) {
    return [parseInt(singleMatch[1])];
  }

  // Match week range, e.g. "1-16周"
  // Match multiple weeks, e.g. "1周,3周,5周" or "1,3,5周"
  // 【修复】旧实现遇到第一个范围就 return，导致 "1-12,15-16周" 只解析出 1-12，丢掉 15、16 两周。
  // 现改为按逗号分段逐段解析，每段可以是范围 "1-12" 也可以是单周 "5"，再合并去重排序。
  const segments = weeksStr.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
  const weeks: number[] = [];
  for (const segment of segments) {
    const rangeMatch = segment.match(/(\d+)\s*[-~]\s*(\d+)/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      if (start >= 1 && end >= start && end <= 30) {
        for (let w = start; w <= end; w++) weeks.push(w);
      }
      continue;
    }
    const singleWeek = segment.match(/(\d+)/);
    if (singleWeek) {
      const w = parseInt(singleWeek[1]);
      if (w >= 1 && w <= 30) weeks.push(w);
    }
  }
  if (weeks.length > 0) {
    return Array.from(new Set(weeks)).sort((a, b) => a - b);
  }

  // 【修复】所有规则都没匹配上 → 返回空数组（原为兜底填满 18 周）
  return [];
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

/**
 * 从上传的文件名中提取姓名
 * 例：
 *   "张三.pdf"                -> "张三"
 *   "张三的课表.png"           -> "张三"
 *   "24大数据1班-张三.pdf"     -> "张三"
 *   "张三-课表-20241012.pdf"   -> "张三"
 *   "刘飞扬的课程表.png"        -> "刘飞扬"
 */
export function extractNameFromFilename(filename?: string): string {
  if (!filename) return '';

  // 1. 去扩展名
  let name = filename.replace(/\.[a-zA-Z0-9]+$/, '');

  // 2. 去日期（任意位置，含 20241012 或 2024-10-12 形式）
  name = name.replace(/[\s_\-—]*20\d{6}[\s_\-—]*/g, '');
  name = name.replace(/[\s_\-—]*\d{8}[\s_\-—]*/g, '');

  // 3. 去课表类词（"的课表"/"课程表"/"课表"/"课程"）
  name = name.replace(/[\s_\-—]*(的|是)?(新)?课(程)?表?[\s_\-—]*/g, '');

  // 4. 去"XX级XX班"（任意位置）
  name = name.replace(/[\s_\-—]*[0-9]{2}[\u4e00-\u9fa5a-zA-Z0-9]*班[\s_\-—]*/g, '');

  // 5. 去尾部序号（如 "(1)" "_2"）
  name = name.replace(/[\s_\-—]*[\(（]?\d+[\)）]?$/, '');

  // 6. 清理首尾分隔符
  name = name.replace(/^[\s_\-—]+|[\s_\-—]+$/g, '').trim();

  // 7. 若还剩多段（用 - _ 空格连接），优先取最长的纯中文姓名段
  if (/[-_—\s]/.test(name)) {
    const parts = name.split(/[\s_\-—]+/).filter(Boolean);
    const cn = parts.find(p => /^[\u4e00-\u9fa5]{2,4}$/.test(p));
    if (cn) name = cn;
  }

  return name;
}
