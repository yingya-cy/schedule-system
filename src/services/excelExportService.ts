import * as XLSX from 'xlsx';

interface PersonData {
  name: string;
  department: string;
  courses: { weekday: number; sections: number[]; weeks: number[] }[];
}

interface AntiScheduleInput {
  departments: string[];
  people: PersonData[];
}

const TIME_PERIODS = [
  { label: '1-2节', sections: [1, 2] },
  { label: '3-4节', sections: [3, 4] },
  { label: '5-6节', sections: [5, 6] },
  { label: '7-8节', sections: [7, 8] },
  { label: '9-11节', sections: [9, 10, 11] },
];

function hasCourse(person: PersonData, day: number, section: number, week: number): boolean {
  return person.courses.some(c =>
    c.weekday === day && c.sections.includes(section) && c.weeks.includes(week)
  );
}

function isFree(person: PersonData, day: number, section: number, week: number): boolean {
  return !hasCourse(person, day, section, week);
}

function consolidateWeeks(weeks: number[]): string {
  if (weeks.length === 0) return '';
  const sorted = [...weeks].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; }
    else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = sorted[i]; prev = sorted[i];
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(',');
}

function detectParity(weeks: number[]): '' | '单' | '双' {
  const allOdd = weeks.every(w => w % 2 === 1);
  const allEven = weeks.every(w => w % 2 === 0);
  if (allOdd) return '单';
  if (allEven) return '双';
  return '';
}

function formatFreeTimeForPeriod(person: PersonData, day: number, periodSections: number[]): string {
  const allWeeks = Array.from({ length: 18 }, (_, i) => i + 1);

  const sectionFree: Map<number, number[]> = new Map();
  for (const s of periodSections) {
    sectionFree.set(s, allWeeks.filter(w => isFree(person, day, s, w)));
  }

  const allFree = allWeeks.filter(w => periodSections.every(s => isFree(person, day, s, w)));

  const sectionOnly: Map<number, number[]> = new Map();
  for (const s of periodSections) {
    const only = sectionFree.get(s)!.filter(w => !allFree.includes(w));
    if (only.length > 0) sectionOnly.set(s, only);
  }

  const parts: string[] = [];
  for (const s of periodSections) {
    const weeks = sectionOnly.get(s);
    if (!weeks || weeks.length === 0) continue;
    const parity = detectParity(weeks);
    parts.push(`${s}${parity}(${consolidateWeeks(weeks)})`);
  }

  if (allFree.length > 0) {
    parts.push(`(${consolidateWeeks(allFree)})`);
  }

  return parts.join('/');
}

export class ExcelExportService {

  generateReverseScheduleForDay(
    input: AntiScheduleInput,
    day: number,
    termName: string = '',
  ): { data: any[][]; merges: XLSX.Range[]; cols: XLSX.ColInfo[] } {
    const { departments, people } = input;
    const activePeople = people.filter(p => p.courses.length > 0);
    const peopleByDept = new Map<string, PersonData[]>();
    for (const p of activePeople) {
      if (!peopleByDept.has(p.department)) peopleByDept.set(p.department, []);
      peopleByDept.get(p.department)!.push(p);
    }
    const deptOrder = departments.filter(d => peopleByDept.has(d));

    let maxPeople = 0;
    for (const deptPeople of peopleByDept.values()) {
      if (deptPeople.length > maxPeople) maxPeople = deptPeople.length;
    }
    const subCols = Math.min(Math.max(maxPeople, 1), 5);

    const sheetData: any[][] = [];
    const titleName = termName ? `第${termName}届朋辈反课表` : '朋辈反课表';
    sheetData.push([titleName]);

    const headerRow2: any[] = ['部门'];
    for (const tp of TIME_PERIODS) {
      headerRow2.push(tp.label);
      for (let i = 1; i < subCols; i++) headerRow2.push('');
    }
    sheetData.push(headerRow2);

    const headerRow3: any[] = [''];
    for (const tp of TIME_PERIODS) {
      for (let i = 0; i < subCols; i++) headerRow3.push('');
    }
    sheetData.push(headerRow3);

    const merges: XLSX.Range[] = [];
    const totalCols = 1 + subCols * TIME_PERIODS.length;
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

    let colIdx = 1;
    for (const tp of TIME_PERIODS) {
      merges.push({ s: { r: 1, c: colIdx }, e: { r: 1, c: colIdx + subCols - 1 } });
      colIdx += subCols;
    }

    let currentRow = 3;
    for (const dept of deptOrder) {
      const deptPeople = peopleByDept.get(dept)!;
      const numRows = Math.ceil(deptPeople.length / subCols);
      const deptStartRow = currentRow;
      if (numRows > 1) {
        merges.push({ s: { r: deptStartRow, c: 0 }, e: { r: deptStartRow + numRows - 1, c: 0 } });
      }

      for (let r = 0; r < numRows; r++) {
        const row: any[] = [r === 0 ? dept : ''];
        for (const tp of TIME_PERIODS) {
          for (let sc = 0; sc < subCols; sc++) {
            const personIdx = r * subCols + sc;
            if (personIdx < deptPeople.length) {
              const person = deptPeople[personIdx];
              const freeNotation = formatFreeTimeForPeriod(person, day, tp.sections);
              row.push(`${person.name}${freeNotation}`);
            } else {
              row.push('');
            }
          }
        }
        sheetData.push(row);
        currentRow++;
      }
    }

    return {
      data: sheetData,
      merges,
      cols: [{ wch: 12 }, ...Array(subCols * TIME_PERIODS.length).fill({ wch: 24 })],
    };
  }

  generateDepartmentStatsExcel(department: string, schedules: any[]): Buffer {
    const wb = XLSX.utils.book_new();
    const sheetData: any[][] = [];
    sheetData.push(['姓名', '部门', '文件名', '课程数量', '创建时间']);
    for (const schedule of schedules) {
      sheetData.push([
        schedule.name,
        schedule.department,
        schedule.filename || '',
        schedule.courses?.length || 0,
        new Date(schedule.created_at).toLocaleString('zh-CN'),
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), department);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  generatePersonScheduleExcel(personName: string, courses: any[]): Buffer {
    const wb = XLSX.utils.book_new();
    const sheetData: string[][] = [];
    sheetData.push(['课程名称', '星期', '节次', '周数', '教师', '地点', '备注']);
    const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    for (const course of courses) {
      const weekdayName = weekdays[course.weekday - 1] || '未知';
      const sections = Array.isArray(course.sections) ? course.sections.join('-') : course.sections;
      const weeks = Array.isArray(course.weeks) ? `${course.weeks[0]}-${course.weeks[course.weeks.length - 1]}` : course.weeks;
      sheetData.push([
        course.course_name,
        weekdayName,
        `${sections}节`,
        `${weeks}周`,
        course.teacher || '',
        course.location || '',
        course.remark || '',
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), personName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}

export default new ExcelExportService();
