import { UnifiedCourse, CourseRecord, BackendCourseData } from '../types';
import { getWeekdayName, formatSection, formatWeekInfo } from './formatters';

export const mapBackendDataToArray = (data: BackendCourseData[]): UnifiedCourse[] => {
  return data.map(item => {
    const dayStr = getWeekdayName(item.weekday || item.day);
    const sectionStr = formatSection(item.section || item.period || item.period);
    
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
