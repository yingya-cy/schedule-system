import * as XLSX from 'xlsx';

interface FreeTimeData {
  total_schedules: number;
  free_time_matrix: Record<string, Record<string, Record<string, string[]>>>;
}

interface WeekRange {
  start: number;
  end: number;
  rule?: 'odd' | 'even';
}

export class ExcelExportService {
  generateReverseScheduleExcel(data: FreeTimeData): Buffer {
    const workbook = XLSX.utils.book_new();
    const worksheetData: any[][] = [];

    const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const sections = Array.from({ length: 11 }, (_, i) => i + 1);

    worksheetData.push(['节', ...weekdays]);

    for (const section of sections) {
      const row: any[] = [`${section}节`];

      for (let day = 1; day <= 7; day++) {
        const cellValue = this.generateCellContent(data, section, day);
        row.push(cellValue);
      }

      worksheetData.push(row);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, '反课表');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return excelBuffer as Buffer;
  }

  private generateCellContent(data: FreeTimeData, section: number, day: number): string {
    const parts: string[] = [];

    for (let week = 1; week <= 18; week++) {
      const weekKey = week.toString();
      const dayKey = day.toString();
      const sectionKey = section.toString();

      if (data.free_time_matrix[weekKey]?.[dayKey]?.[sectionKey]) {
        const freePeople = data.free_time_matrix[weekKey][dayKey][sectionKey];
        if (freePeople.length > 0) {
          parts.push(`${section}(${week})`);
        }
      }
    }

    if (parts.length === 0) {
      return '';
    }

    return this.mergeWeekRanges(parts);
  }

  private mergeWeekRanges(parts: string[]): string {
    const sectionMap = new Map<number, Set<number>>();

    for (const part of parts) {
      const match = part.match(/(\d+)\((\d+)\)/);
      if (match) {
        const section = parseInt(match[1]);
        const week = parseInt(match[2]);

        if (!sectionMap.has(section)) {
          sectionMap.set(section, new Set());
        }
        sectionMap.get(section)!.add(week);
      }
    }

    const result: string[] = [];

    for (const [section, weeks] of sectionMap.entries()) {
      const sortedWeeks = Array.from(weeks).sort((a, b) => a - b);
      const weekRanges = this.consolidateWeeks(sortedWeeks);
      result.push(`${section}(${weekRanges})`);
    }

    return result.join('/');
  }

  private consolidateWeeks(weeks: number[]): string {
    if (weeks.length === 0) return '';

    const ranges: WeekRange[] = [];
    let start = weeks[0];
    let prev = weeks[0];

    for (let i = 1; i < weeks.length; i++) {
      const current = weeks[i];

      if (current === prev + 1) {
        prev = current;
      } else {
        ranges.push({ start, end: prev });
        start = current;
        prev = current;
      }
    }

    ranges.push({ start, end: prev });

    return ranges.map(r => `${r.start}-${r.end}`).join(',');
  }

  generatePersonScheduleExcel(personName: string, courses: any[]): Buffer {
    const workbook = XLSX.utils.book_new();
    const worksheetData: any[][] = [];

    worksheetData.push(['课程名称', '星期', '节次', '周数', '教师', '地点', '备注']);

    const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    for (const course of courses) {
      const weekdayName = weekdays[course.weekday - 1] || '未知';
      const sections = Array.isArray(course.sections) ? course.sections.join('-') : course.sections;
      const weeks = Array.isArray(course.weeks) ? `${course.weeks[0]}-${course.weeks[course.weeks.length - 1]}` : course.weeks;

      worksheetData.push([
        course.course_name,
        weekdayName,
        `${sections}节`,
        `${weeks}周`,
        course.teacher || '',
        course.location || '',
        course.remark || ''
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, personName);

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return excelBuffer as Buffer;
  }

  generateDepartmentStatsExcel(department: string, schedules: any[]): Buffer {
    const workbook = XLSX.utils.book_new();
    const worksheetData: any[][] = [];

    worksheetData.push(['姓名', '部门', '文件名', '课程数量', '创建时间']);

    for (const schedule of schedules) {
      worksheetData.push([
        schedule.name,
        schedule.department,
        schedule.filename || '',
        schedule.courses?.length || 0,
        new Date(schedule.created_at).toLocaleString('zh-CN')
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, department);

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return excelBuffer as Buffer;
  }
}

export default new ExcelExportService();
