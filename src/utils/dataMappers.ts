import { UnifiedCourse, CourseRecord, BackendCourseData } from '../types';
import { getWeekdayName, formatSection, formatWeekInfo } from './formatters';

export function parsePeriod(section: unknown): number[] {
  if (Array.isArray(section)) return section;
  if (!section) return [];
  const match = String(section).match(/(\d+)[-~](\d+)节?/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    // 【修复】节次上限 24，与 FilesView/utils.ts 的 parseSections 保持一致。
    // 少了这道校验时，课名里的年份区间（如 "1919-1949"）会被当成节次展开成 31 个数字。
    if (start < 1 || end < start || end > 24) return [];
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  const singleMatch = String(section).match(/第?(\d+)节/);
  if (singleMatch) {
    const sectionNumber = parseInt(singleMatch[1]);
    // 【修复】单个节次同样做边界校验，避免 "第1919节" 之类误识别
    return sectionNumber >= 1 && sectionNumber <= 24 ? [sectionNumber] : [];
  }
  return [];
}

export function mapBackendDataToArray(data: BackendCourseData[]): UnifiedCourse[] {
  return data
    .map(item => {
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
    // 【修复】解析不出有效节次时保留后端原始字符串，不要清空。
    // 之前清空会让 time 只剩"星期二"，下游 parseSections 命中 [1, 2] 兜底，
    // 等于把"无效节次"悄悄变成"有效节次"，上传前的 assertValidCourseSections 校验就形同虚设。
    const rawSectionText = [item.section, item.period].find(
      (value): value is string => typeof value === 'string' && value.trim() !== ''
    ) || '';
    const sectionStr = sectionArray.length > 0
      ? `${sectionArray[0]}-${sectionArray[sectionArray.length - 1]}节`
      : rawSectionText.trim();
    
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
