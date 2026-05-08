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

// Rotating department background colors
const deptColors = ['FFD9E1F4', 'FFC5E0B4', 'FFB4C7E7', 'FFF9CBAA', 'FFE3F2D9', 'FFFFFF99', 'FFF4B4C2', 'FFD0CECE'];
let deptColorIdx = 0;
function nextDeptColor(): string {
  const c = deptColors[deptColorIdx % deptColors.length];
  deptColorIdx++;
  return c;
}

function styleCell(cell: ExcelJS.Cell, font: any, fill?: string) {
  cell.font = font;
  cell.alignment = centerMiddle;
  cell.border = thinBorder;
  if (fill) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  }
}

function colLetter(n: number): string {
  let s = '';
  n--;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
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
    for (const dp of peopleByDept.values()) { if (dp.length > maxPeople) maxPeople = dp.length; }
    const subCols = Math.min(Math.max(maxPeople, 1), 5);
    // Total columns: A=部门, then for each period: subCols + 1 separator (except last period has no separator)
    const totalCols = 1 + TIME_PERIODS.length * (subCols + 1) - 1;

    deptColorIdx = 0;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Academic Ether';

    for (let day = 1; day <= 7; day++) {
      const ws = wb.addWorksheet(dayNames[day - 1]);

      // === Row 1: Title ===
      ws.mergeCells(1, 1, 1, totalCols);
      const titleName = termName ? `第${termName}届朋辈反课表` : '朋辈反课表';
      const titleCell = ws.getCell('A1');
      titleCell.value = titleName;
      styleCell(titleCell, { name: '微软雅黑', size: 48, bold: true });
      ws.getRow(1).height = 61.5;

      // === Row 2-3: Headers ===
      // A2:A3 merged = 部门
      ws.mergeCells(2, 1, 3, 1);
      const deptHdr = ws.getCell('A2');
      deptHdr.value = '部门';
      styleCell(deptHdr, { name: '微软雅黑', size: 22, bold: true });
      ws.getCell('A3').border = thinBorder; // ensure border on merged cell

      // B2 = 时间 (merged across all period columns)
      const timeHeaderEnd = totalCols;
      ws.mergeCells(2, 2, 2, timeHeaderEnd);
      const timeHdr = ws.getCell('B2');
      timeHdr.value = '时间';
      styleCell(timeHdr, { name: '微软雅黑', size: 22, bold: true });

      // Row 3: time period labels (each merged across subCols), with separators between
      let col = 2;
      for (let tpIdx = 0; tpIdx < TIME_PERIODS.length; tpIdx++) {
        const tp = TIME_PERIODS[tpIdx];
        ws.mergeCells(3, col, 3, col + subCols - 1);
        const tpCell = ws.getCell(3, col);
        tpCell.value = tp.label;
        styleCell(tpCell, { name: '微软雅黑', size: 22, bold: true });
        for (let i = 0; i < subCols; i++) {
          styleCell(ws.getCell(3, col + i), { name: '微软雅黑', size: 22, bold: true });
        }
        col += subCols;
        // Separator column after each period (except last)
        if (tpIdx < TIME_PERIODS.length - 1) {
          // Merge separator through rows 3-26 (header through data)
          // We'll just set the separator column headers
          styleCell(ws.getCell(3, col), { name: '微软雅黑', size: 22, bold: true });
          col++;
        }
      }
      ws.getRow(2).height = 27;
      ws.getRow(3).height = 27;

      // === Data rows (starting row 4) ===
      let dataRow = 4;
      const deptMergeGroups: { startRow: number; people: PersonData[]; dept: string; color: string }[] = [];
      for (const dept of deptOrder) {
        const deptPeople = peopleByDept.get(dept)!;
        deptMergeGroups.push({ startRow: dataRow, people: deptPeople, dept, color: nextDeptColor() });
        dataRow += deptPeople.length;
      }
      dataRow = 4;
      for (const grp of deptMergeGroups) {
        const deptStart = dataRow;
        const deptEnd = deptStart + grp.people.length - 1;

        // Department column (A) — merge once per department
        if (grp.people.length > 1) {
          ws.mergeCells(deptStart, 1, deptEnd, 1);
        }
        const dc = ws.getCell(deptStart, 1);
        dc.value = grp.dept;
        styleCell(dc, { name: '微软雅黑', size: 14, bold: false }, grp.color);
        // Style remaining merged cells
        for (let mr = deptStart + 1; mr <= deptEnd; mr++) {
          styleCell(ws.getCell(mr, 1), { name: '微软雅黑', size: 14, bold: false }, grp.color);
        }

        for (let pi = 0; pi < grp.people.length; pi++) {
          const rowNum = dataRow;
          const person = grp.people[pi];

          // Time period data
          col = 2;
          for (let tpIdx = 0; tpIdx < TIME_PERIODS.length; tpIdx++) {
            const tp = TIME_PERIODS[tpIdx];
            // Each person occupies sub-column position pi within this period
            for (let sc = 0; sc < subCols; sc++) {
              const cell = ws.getCell(rowNum, col);
              if (sc === pi) {
                const freeNotation = formatFreeTimeForPeriod(person, day, tp.sections);
                cell.value = person.name + freeNotation;
              }
              styleCell(cell, { name: '微软雅黑', size: 10 });
              col++;
            }
            // Separator column
            if (tpIdx < TIME_PERIODS.length - 1) {
              styleCell(ws.getCell(rowNum, col), { name: '微软雅黑', size: 10 });
              col++;
            }
          }
          ws.getRow(rowNum).height = 56.2;
          dataRow++;
        }
      }

      // Column widths
      ws.getColumn(1).width = 10.6;
      col = 2;
      for (let tpIdx = 0; tpIdx < TIME_PERIODS.length; tpIdx++) {
        for (let sc = 0; sc < subCols; sc++) {
          ws.getColumn(col).width = 23.5;
          col++;
        }
        if (tpIdx < TIME_PERIODS.length - 1) {
          ws.getColumn(col).width = 1.6;
          col++;
        }
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
