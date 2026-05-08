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

const dayNames = ['星期一', '星期二', '星期三', '星期四', '星期五'];

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
const centerWrap: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
const fontName = '等线';
const FONT = { data: { name: fontName, size: 14 }, title: { name: fontName, size: 48, bold: true }, header: { name: fontName, size: 22, bold: true } };

// Rotating department background colors
const deptColors = ['FFD9E1F4', 'FFC5E0B4', 'FFB4C7E7', 'FFF9CBAA', 'FFE3F2D9', 'FFFFFF99', 'FFF4B4C2', 'FFD0CECE'];
let deptColorIdx = 0;
function nextDeptColor(): string { return deptColors[deptColorIdx++ % deptColors.length]; }

function sc(cell: ExcelJS.Cell, font: any, fill?: string) {
  cell.font = font;
  cell.alignment = centerWrap;
  cell.border = thinBorder;
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
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
    const totalCols = 1 + TIME_PERIODS.length * (subCols + 1) - 1;

    deptColorIdx = 0;
    const wb = new ExcelJS.Workbook();

    // Build dept groups first to know the last data row for separator merges
    const deptGroups: { dept: string; people: PersonData[]; color: string }[] = [];
    for (const dept of deptOrder) {
      deptGroups.push({ dept, people: peopleByDept.get(dept)!, color: nextDeptColor() });
    }
    let totalDataRows = 4;
    for (const g of deptGroups) totalDataRows += Math.ceil(g.people.length / subCols);
    const lastDataRow = totalDataRows - 1;

    for (let day = 1; day <= 5; day++) {
      const ws = wb.addWorksheet(dayNames[day - 1]);

      // === Row 1: Title ===
      ws.mergeCells(1, 1, 1, totalCols);
      const titleCell = ws.getCell('A1');
      titleCell.value = termName ? `第${termName}届朋辈反课表` : '朋辈反课表';
      sc(titleCell, FONT.title);
      ws.getRow(1).height = 61.1;

      // === Row 2-3: Headers ===
      ws.mergeCells(2, 1, 3, 1);
      sc(ws.getCell('A2'), FONT.header);
      ws.getCell('A2').value = '部门';

      ws.mergeCells(2, 2, 2, totalCols);
      sc(ws.getCell('B2'), FONT.header);
      ws.getCell('B2').value = '时间';

      // Row 3: time period labels
      let col = 2;
      for (let tpIdx = 0; tpIdx < TIME_PERIODS.length; tpIdx++) {
        const tp = TIME_PERIODS[tpIdx];
        ws.mergeCells(3, col, 3, col + subCols - 1);
        sc(ws.getCell(3, col), FONT.header);
        ws.getCell(3, col).value = tp.label;
        for (let i = 0; i < subCols; i++) sc(ws.getCell(3, col + i), FONT.header);
        col += subCols;
        if (tpIdx < TIME_PERIODS.length - 1) {
          ws.mergeCells(3, col, lastDataRow, col); // separator merged through all rows
          col++;
        }
      }
      ws.getRow(2).height = 27.75;
      ws.getRow(3).height = 27.75;

      // === Data rows (grid layout: subCols people per row) ===
      let dataRow = 4;
      for (const grp of deptGroups) {
        const numRows = Math.ceil(grp.people.length / subCols);
        const deptStart = dataRow;
        const deptEnd = deptStart + numRows - 1;

        if (numRows > 1) {
          ws.mergeCells(deptStart, 1, deptEnd, 1);
        }
        sc(ws.getCell(deptStart, 1), FONT.data, grp.color);
        ws.getCell(deptStart, 1).value = grp.dept;

        for (let r = 0; r < numRows; r++) {
          const rowNum = deptStart + r;

          // Apply bg color to ALL cells in this row
          for (let c = 1; c <= totalCols; c++) {
            sc(ws.getCell(rowNum, c), FONT.data, grp.color);
          }

          col = 2;
          for (let tpIdx = 0; tpIdx < TIME_PERIODS.length; tpIdx++) {
            const tp = TIME_PERIODS[tpIdx];
            for (let sc2 = 0; sc2 < subCols; sc2++) {
              const pi = r * subCols + sc2;
              if (pi < grp.people.length) {
                const person = grp.people[pi];
                const freeNotation = formatFreeTimeForPeriod(person, day, tp.sections);
                ws.getCell(rowNum, col).value = person.name + freeNotation;
              }
              col++;
            }
            if (tpIdx < TIME_PERIODS.length - 1) col++;
          }

          ws.getRow(rowNum).height = 56.25;
        }
        dataRow = deptEnd + 1;
      }

      // Column widths
      ws.getColumn(1).width = 10.6;
      col = 2;
      for (let tpIdx = 0; tpIdx < TIME_PERIODS.length; tpIdx++) {
        for (let sc2 = 0; sc2 < subCols; sc2++) {
          ws.getColumn(col).width = sc2 === 0 ? 23.5 : 13.0;
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
