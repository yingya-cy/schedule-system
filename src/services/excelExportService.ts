import ExcelJS from 'exceljs';
import { columnLetter } from '../utils/formatters.ts';

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

export function formatWeekGroups(weeks: number[], step?: number, sep = '/'): string {
  if (weeks.length === 0) return '';
  const sorted = [...weeks].sort((a, b) => a - b);
  if (step === undefined) {
    const allOdd = sorted.every(w => w % 2 === 1);
    const allEven = sorted.every(w => w % 2 === 0);
    step = (allOdd || allEven) ? 2 : 1;
  }
  const parts: string[] = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + step!) { prev = sorted[i]; }
    else {
      parts.push(start === prev ? `(${start})` : `(${start}-${prev})`);
      start = sorted[i]; prev = sorted[i];
    }
  }
  parts.push(start === prev ? `(${start})` : `(${start}-${prev})`);
  return parts.join(sep);
}

export function detectParity(weeks: number[]): '' | '单' | '双' {
  if (weeks.length === 0) return '';
  if (weeks.every(w => w % 2 === 1)) return '单';
  if (weeks.every(w => w % 2 === 0)) return '双';
  return '';
}

export function formatWeeks(weeks: number[]): string {
  if (weeks.length === 0) return '';
  const sorted = [...weeks].sort((a, b) => a - b);

  // Try whole-array parity first
  const parity = sorted.length > 1 ? detectParity(sorted) : '';
  if (parity) return parity + formatWeekGroups(sorted);

  // Split into homogeneous-step runs
  const runs: number[][] = [];
  let cur: number[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = cur[cur.length - 1];
    const curr = sorted[i];
    const diff = curr - prev;

    if (cur.length === 1 && diff <= 2) {
      cur.push(curr);
    } else if (cur.length === 1) {
      runs.push(cur);
      cur = [curr];
    } else {
      const curStep = cur[1] - cur[0];
      if (diff === curStep) {
        cur.push(curr);
      } else {
        runs.push(cur);
        cur = [curr];
      }
    }
  }
  runs.push(cur);

  const formatted = runs.map(r => {
    if (r.length <= 1) return { text: formatWeekGroups(r), parity: '' };
    const f = formatWeekGroups(r);
    if (f.includes('-')) {
      const p = detectParity(r);
      if (p) return { text: p + f, parity: p };
    }
    return { text: f, parity: '' };
  });

  const withP = formatted.filter(r => r.parity);
  const withoutP = formatted.filter(r => !r.parity);
  if (withP.length > 0) {
    const head = withP.map(r => r.text).join('');
    const tail = withoutP.map(r => r.text).join('');
    return tail ? `${head}/${tail}` : head;
  }
  return formatted.map(r => r.text).join('/');
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

  // Use plain formatter for in-section display: smart split but no / and no 单/双
  const fmtPlain = (w: number[]) => formatWeeks(w).replace(/[\/单双]/g, '');

  const allFreeStr = allFree.length > 0 ? fmtPlain(allFree) : '';
  const cellParts: string[] = [];
  let hasSectionSpecific = false;
  for (const s of periodSections) {
    const only = sectionOnly.get(s);
    if (!only || only.length === 0) continue;
    hasSectionSpecific = true;
    const onlyStr = fmtPlain(only);
    cellParts.push(allFreeStr ? `${s}${onlyStr}/${allFreeStr}` : `${s}${onlyStr}`);
  }
  // If no section-specific data, use formatWeeks for pure free-time display (with / and 单/双)
  if (!hasSectionSpecific) return formatWeeks(allFree);
  return cellParts.join('');
}

// Shared styles
const thinBorder = {
  top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
  left: { style: 'thin' as const }, right: { style: 'thin' as const },
};
const centerWrap: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
const fontName = '宋体';
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

    const subCols = 3;
    const totalCols = 1 + TIME_PERIODS.length * (subCols + 1) - 1;

    deptColorIdx = 0;
    const wb = new ExcelJS.Workbook();

    const deptGroups: { dept: string; people: PersonData[]; color: string }[] = [];
    for (const dept of deptOrder) {
      deptGroups.push({ dept, people: peopleByDept.get(dept)!, color: nextDeptColor() });
    }

    for (let day = 1; day <= 5; day++) {
      const ws = wb.addWorksheet(dayNames[day - 1]);

      // Pre-compute per-dept per-period people with free time
      const dayDept = deptGroups.map(g => ({
        ...g,
        periodPeople: TIME_PERIODS.map(tp =>
          g.people.filter(p => formatFreeTimeForPeriod(p, day, tp.sections))
        ),
      }));
      // Row count per dept
      const deptRows: number[] = dayDept.map(d => {
        const maxP = Math.max(...d.periodPeople.map(pp => pp.length), 1);
        return Math.ceil(maxP / subCols);
      });
      const totalDataRows = 4 + deptRows.reduce((a, b) => a + b, 0);
      const lastDataRow = totalDataRows - 1;

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

      // Row 3: time period labels & separator merges
      let col = 2;
      for (let tpIdx = 0; tpIdx < TIME_PERIODS.length; tpIdx++) {
        const tp = TIME_PERIODS[tpIdx];
        ws.mergeCells(3, col, 3, col + subCols - 1);
        sc(ws.getCell(3, col), FONT.header);
        ws.getCell(3, col).value = tp.label;
        for (let i = 0; i < subCols; i++) sc(ws.getCell(3, col + i), FONT.header);
        col += subCols;
        if (tpIdx < TIME_PERIODS.length - 1) {
          ws.mergeCells(3, col, lastDataRow, col);
          col++;
        }
      }
      ws.getRow(2).height = 27.75;
      ws.getRow(3).height = 27.75;

      // === Data rows ===
      let dataRow = 4;
      for (let di = 0; di < dayDept.length; di++) {
        const d = dayDept[di];
        const numRows = deptRows[di];
        const deptStart = dataRow;
        const deptEnd = deptStart + numRows - 1;

        if (numRows > 1) {
          ws.mergeCells(deptStart, 1, deptEnd, 1);
        }
        sc(ws.getCell(deptStart, 1), FONT.data, d.color);
        ws.getCell(deptStart, 1).value = d.dept;

        for (let r = 0; r < numRows; r++) {
          const rowNum = deptStart + r;
          sc(ws.getCell(rowNum, 1), FONT.data, d.color);

          col = 2;
          for (let tpIdx = 0; tpIdx < TIME_PERIODS.length; tpIdx++) {
            const pp = d.periodPeople[tpIdx];
            for (let sc2 = 0; sc2 < subCols; sc2++) {
              const pi = r * subCols + sc2;
              if (pi < pp.length) {
                const person = pp[pi];
                const freeNotation = formatFreeTimeForPeriod(person, day, TIME_PERIODS[tpIdx].sections);
                ws.getCell(rowNum, col).value = person.name + freeNotation;
              }
              sc(ws.getCell(rowNum, col), FONT.data, d.color);
              col++;
            }
            if (tpIdx < TIME_PERIODS.length - 1) col++;
          }

          ws.getRow(rowNum).height = 56.25;
        }
        dataRow = deptEnd + 1;
      }

      // Column widths
      ws.getColumn(1).width = 9.46;
      col = 2;
      for (let tpIdx = 0; tpIdx < TIME_PERIODS.length; tpIdx++) {
        for (let sc2 = 0; sc2 < subCols; sc2++) {
          ws.getColumn(col).width = 20.84;
          col++;
        }
        if (tpIdx < TIME_PERIODS.length - 1) {
          ws.getColumn(col).width = 1.46;
          col++;
        }
      }
    }

    return wb;
  }

  async generateDepartmentStatsExcel(department: string, schedules: any[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(department);
    ws.addRow(['姓名', '部门', '文件名', '课程数量', '创建时间']);
    for (const s of schedules) {
      ws.addRow([s.name, s.department, s.filename || '', s.courses?.length || 0,
        new Date(s.created_at).toLocaleString('zh-CN')]);
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async generatePersonScheduleExcel(personName: string, courses: any[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(personName);
    ws.addRow(['课程名称', '星期', '节次', '周数', '教师', '地点', '备注']);
    const wds = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    for (const c of courses) {
      const s = Array.isArray(c.sections) ? c.sections.join('-') : c.sections;
      const w = Array.isArray(c.weeks) ? `${c.weeks[0]}-${c.weeks[c.weeks.length - 1]}` : c.weeks;
      ws.addRow([c.course_name, wds[c.weekday - 1] || '', `${s}节`, `${w}周`, c.teacher || '', c.location || '', c.remark || '']);
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}

export default new ExcelExportService();
