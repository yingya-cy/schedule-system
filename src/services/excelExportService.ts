import ExcelJS from 'exceljs';
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

const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

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
  if (weeks.length === 0) return '';
  if (weeks.every(w => w % 2 === 1)) return '单';
  if (weeks.every(w => w % 2 === 0)) return '双';
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
    parts.push(`${s}${detectParity(weeks)}(${consolidateWeeks(weeks)})`);
  }

  if (allFree.length > 0) {
    parts.push(`(${consolidateWeeks(allFree)})`);
  }

  return parts.join('/');
}

// Shared styles
const thinBorder = {
  top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
  left: { style: 'thin' as const }, right: { style: 'thin' as const },
};
const centerMiddle: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
const font10 = { name: '微软雅黑', size: 10 };
const font11 = { name: '微软雅黑', size: 11 };
const fontBold12 = { name: '微软雅黑', size: 12, bold: true };
const fontBold14 = { name: '微软雅黑', size: 14, bold: true };

function styleCell(cell: ExcelJS.Cell, font: any, fill?: string) {
  cell.font = font;
  cell.alignment = centerMiddle;
  cell.border = thinBorder;
  if (fill) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  }
}

export class ExcelExportService {

  async generateReverseScheduleWorkbook(
    input: AntiScheduleInput,
    termName: string = '',
  ): Promise<ExcelJS.Workbook> {
    const { departments, people } = input;
    const activePeople = people.filter(p => p.courses.length > 0);
    const peopleByDept = new Map<string, PersonData[]>();
    for (const p of activePeople) {
      if (!peopleByDept.has(p.department)) peopleByDept.set(p.department, []);
      peopleByDept.get(p.department)!.push(p);
    }
    const deptOrder = departments.filter(d => peopleByDept.has(d));

    let maxPeople = 0;
    for (const dp of peopleByDept.values()) {
      if (dp.length > maxPeople) maxPeople = dp.length;
    }
    const subCols = Math.min(Math.max(maxPeople, 1), 5);
    const totalCols = 1 + subCols * TIME_PERIODS.length;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Academic Ether';

    for (let day = 1; day <= 7; day++) {
      const ws = wb.addWorksheet(dayNames[day - 1]);

      // Title (row 1, merged)
      ws.mergeCells(1, 1, 1, totalCols);
      const titleName = termName ? `第${termName}届朋辈反课表` : '朋辈反课表';
      const titleCell = ws.getCell('A1');
      titleCell.value = titleName;
      styleCell(titleCell, { name: '微软雅黑', size: 16, bold: true });
      ws.getRow(1).height = 28;

      // Row 2: 部门 | 时间段 headers
      ws.getCell(2, 1).value = '部门';
      styleCell(ws.getCell(2, 1), fontBold12);
      let colIdx = 2;
      for (const tp of TIME_PERIODS) {
        ws.mergeCells(2, colIdx, 2, colIdx + subCols - 1);
        const hdr = ws.getCell(2, colIdx);
        hdr.value = tp.label;
        styleCell(hdr, fontBold12);
        for (let i = 0; i < subCols; i++) {
          styleCell(ws.getCell(2, colIdx + i), fontBold12);
        }
        colIdx += subCols;
      }
      ws.getRow(2).height = 22;

      // Row 3+: departments and people data
      let currentRow = 3;
      for (const dept of deptOrder) {
        const deptPeople = peopleByDept.get(dept)!;
        const numRows = Math.ceil(deptPeople.length / subCols);
        const deptStartRow = currentRow;

        if (numRows > 1) {
          ws.mergeCells(deptStartRow, 1, deptStartRow + numRows - 1, 1);
        }
        // Department row header color
        const deptFill = 'FFE8F0FE'; // light blue tint

        for (let r = 0; r < numRows; r++) {
          const rowNum = deptStartRow + r;
          // Department name in column A (first row only)
          if (r === 0) {
            const dc = ws.getCell(rowNum, 1);
            dc.value = dept;
            styleCell(dc, fontBold12, deptFill);
          } else {
            styleCell(ws.getCell(rowNum, 1), font11, deptFill);
          }

          colIdx = 2;
          for (const tp of TIME_PERIODS) {
            for (let sc = 0; sc < subCols; sc++) {
              const personIdx = r * subCols + sc;
              const cell = ws.getCell(rowNum, colIdx);
              if (personIdx < deptPeople.length) {
                const person = deptPeople[personIdx];
                const freeNotation = formatFreeTimeForPeriod(person, day, tp.sections);
                cell.value = person.name + freeNotation;
                styleCell(cell, font10);
              } else {
                styleCell(cell, font10);
              }
              colIdx++;
            }
          }
        }
        currentRow += numRows;
      }

      // Column widths
      ws.getColumn(1).width = 14;
      for (let c = 2; c <= totalCols; c++) {
        ws.getColumn(c).width = 24;
      }
    }

    return wb;
  }

  // Legacy exports (keep using xlsx for simple exports)
  generateDepartmentStatsExcel(department: string, schedules: any[]): Buffer {
    const wb = XLSX.utils.book_new();
    const data: any[][] = [['姓名', '部门', '文件名', '课程数量', '创建时间']];
    for (const s of schedules) {
      data.push([s.name, s.department, s.filename || '', s.courses?.length || 0,
        new Date(s.created_at).toLocaleString('zh-CN')]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), department);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  generatePersonScheduleExcel(personName: string, courses: any[]): Buffer {
    const wb = XLSX.utils.book_new();
    const data: string[][] = [['课程名称', '星期', '节次', '周数', '教师', '地点', '备注']];
    const wds = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    for (const c of courses) {
      const s = Array.isArray(c.sections) ? c.sections.join('-') : c.sections;
      const w = Array.isArray(c.weeks) ? `${c.weeks[0]}-${c.weeks[c.weeks.length - 1]}` : c.weeks;
      data.push([c.course_name, wds[c.weekday - 1] || '', `${s}节`, `${w}周`, c.teacher || '', c.location || '', c.remark || '']);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), personName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}

export default new ExcelExportService();
