import { UnifiedCourse, CourseRecord, BackendCourseData } from '../types';
import { getWeekdayName, formatSection, formatWeekInfo } from './formatters';

export function parsePeriod(section: unknown): number[] {
  if (Array.isArray(section)) return section;
  if (!section) return [];
  const match = String(section).match(/(\d+)[-~](\d+)节?/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  const singleMatch = String(section).match(/第?(\d+)节/);
  if (singleMatch) return [parseInt(singleMatch[1])];
  return [];
}

export function mapBackendDataToArray(data: BackendCourseData[]): UnifiedCourse[] {
  return data.map(item => {
    const dayStr = getWeekdayName(item.weekday || item.day);

    // item.section 可能是数组（如 AI OCR）也可能是字符串（如旧格式）
    // item.period 是 PDF 本地解析格式
    const sectionArray = Array.isArray(item.section)
      ? item.section
      : item.section
        ? parsePeriod(item.section)
        : item.period
          ? parsePeriod(item.period)
          : [];
    const sectionStr = sectionArray.length > 0
      ? `${sectionArray[0]}-${sectionArray[sectionArray.length - 1]}节`
      : '';
    
    return {
      courseName: item.course_name || item.course || item.name || '未知课程',
      time: `${dayStr} ${sectionStr}`.trim() || '未指定时间',
      weeks: formatWeekInfo(item.week || item.weeks),
      weeksList: item.weeks_list,
      teacher: item.teacher || '',
      classroom: item.classroom || item.location || '',
      remark: item.remark || ''
    };
  });
};

export const mapFrontendDataToArray = (data: CourseRecord[]): UnifiedCourse[] => {
  return data.map(item => {
    let weeksStr = '未指定';
    if (item.weeks && item.weeks.length > 0) {
      weeksStr = `${item.weeks[0]}-${item.weeks[item.weeks.length-1]}周`;
    }
    return {
      courseName: item.courseName || '未知课程',
      time: `${item.dayOfWeek || ''} ${item.sessionRaw || ''}`.trim() || '未指定时间',
      weeks: weeksStr
    };
  });
};
