import ExcelJS from 'exceljs';
import { columnLetter } from '../utils/formatters.ts';
import type { Schedule, Course } from '../types/database.ts';

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

interface WeekSegment {
  weeks: number[];
  text: string;
  parity: boolean;
  mask: number;
}

interface WeekSolution {
  segments: WeekSegment[];
  textLength: number;
  parityCount: number;
}

function weekMask(weeks: number[]): number {
  return weeks.reduce((mask, week) => mask | (1 << (week - 1)), 0);
}

function formatWeekSegments(weeks: number[]): WeekSegment[] {
  const sorted = [...new Set(weeks)].filter(w => w >= 1 && w <= 18).sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const targetMask = weekMask(sorted);
  const available = new Set(sorted);
  const candidatesByMask = new Map<number, WeekSegment>();

  const addCandidate = (values: number[], text: string, parity: boolean) => {
    const mask = weekMask(values);
    const current = candidatesByMask.get(mask);
    if (!current || text.length < current.text.length ||
        (text.length === current.text.length && current.parity && !parity)) {
      candidatesByMask.set(mask, { weeks: values, text, parity, mask });
    }
  };

  for (const start of sorted) {
    const consecutive: number[] = [];
    for (let end = start; end <= 18 && available.has(end); end++) {
      consecutive.push(end);
      addCandidate(
        [...consecutive],
        start === end ? `(${start})` : `(${start}-${end})`,
        false,
      );
    }

    const sameParity: number[] = [];
    for (let end = start; end <= 18 && available.has(end); end += 2) {
      sameParity.push(end);
      if (sameParity.length >= 2) {
        addCandidate(
          [...sameParity],
          `${start % 2 === 1 ? '单' : '双'}(${start}-${end})`,
          true,
        );
      }
    }
  }

  const candidates = [...candidatesByMask.values()];
  const memo = new Map<number, WeekSolution>();
  const solve = (remaining: number): WeekSolution => {
    if (remaining === 0) return { segments: [], textLength: 0, parityCount: 0 };
    const cached = memo.get(remaining);
    if (cached) return cached;

    const firstBit = remaining & -remaining;
    let best: WeekSolution | undefined;
    for (const candidate of candidates) {
      if ((candidate.mask & firstBit) === 0 || (candidate.mask & remaining) !== candidate.mask) continue;
      const rest = solve(remaining & ~candidate.mask);
      const solution: WeekSolution = {
        segments: [candidate, ...rest.segments],
        textLength: candidate.text.length + rest.textLength + (rest.segments.length > 0 ? 1 : 0),
        parityCount: Number(candidate.parity) + rest.parityCount,
      };
      if (!best || solution.textLength < best.textLength ||
          (solution.textLength === best.textLength && solution.segments.length < best.segments.length) ||
          (solution.textLength === best.textLength && solution.segments.length === best.segments.length &&
            solution.parityCount < best.parityCount)) {
        best = solution;
      }
    }

    memo.set(remaining, best!);
    return best!;
  };

  return solve(targetMask).segments;
}

export function formatWeeks(weeks: number[]): string {
  return formatWeekSegments(weeks).map(segment => segment.text).join('/');
}

function formatFreeTimeForPeriod(person: PersonData, day: number, periodSections: number[]): string {
  const allWeeks = Array.from({ length: 18 }, (_, i) => i + 1);

  const sectionFree: Map<number, number[]> = new Map();
  for (const s of periodSections) {
    sectionFree.set(s, allWeeks.filter(w => isFree(person, day, s, w)));
  }

  const allFree = allWeeks.filter(w => periodSections.every(s => isFree(person, day, s, w)));

  const hasSectionSpecific = periodSections.some(section =>
    sectionFree.get(section)!.some(week => !allFree.includes(week))
  );
  if (!hasSectionSpecific) return formatWeeks(allFree);

  interface ScopedSegment extends WeekSegment { section?: number }
  interface NotationPlan {
    segments: ScopedSegment[];
    text: string;
    groupCount: number;
  }

  const expectedPairs = new Set<string>();
  for (const section of periodSections) {
    for (const week of sectionFree.get(section)!) expectedPairs.add(`${section}:${week}`);
  }

  const buildPlan = (commonWeeks: number[]): NotationPlan | undefined => {
    const common = new Set(commonWeeks);
    if (commonWeeks.some(week => !allFree.includes(week))) return undefined;

    const segments: ScopedSegment[] = [];
    for (const section of periodSections) {
      const residual = sectionFree.get(section)!.filter(week => !common.has(week));
      for (const segment of formatWeekSegments(residual)) segments.push({ ...segment, section });
    }
    for (const segment of formatWeekSegments(commonWeeks)) segments.push(segment);

    const actualPairs = new Set<string>();
    for (const segment of segments) {
      const scopedSections = segment.section === undefined ? periodSections : [segment.section];
      for (const section of scopedSections) {
        for (const week of segment.weeks) actualPairs.add(`${section}:${week}`);
      }
    }
    if (actualPairs.size !== expectedPairs.size ||
        [...expectedPairs].some(pair => !actualPairs.has(pair))) return undefined;

    const groups: Array<{ section?: number; clauses: string[] }> = [];
    let selectionGroupCount = 0;
    let previousSelectionKey: string | undefined;
    for (const segment of segments) {
      const useParity = segment.parity && segment.weeks.length > 2;
      const modifier = useParity ? segment.text.slice(0, 1) : '';
      const weekTexts = segment.parity && !useParity
        ? segment.weeks.map(week => `(${week})`)
        : [useParity ? segment.text.slice(1) : segment.text];
      const clause = `${modifier}${weekTexts.join('')}`;
      const selectionKey = `${segment.section ?? 'common'}:${modifier}`;
      if (selectionKey !== previousSelectionKey) {
        selectionGroupCount++;
        previousSelectionKey = selectionKey;
      }
      const previous = groups[groups.length - 1];
      if (previous && previous.section === segment.section) {
        previous.clauses.push(clause);
      } else {
        groups.push({ section: segment.section, clauses: [clause] });
      }
    }

    return {
      segments,
      text: groups
        .map(group => `${group.section ?? ''}${group.clauses.join('')}`)
        .join('/'),
      groupCount: selectionGroupCount,
    };
  };

  // Preserve the conventional shared semester tail when both final weeks are
  // free. Otherwise keep all shared weeks unscoped before falling back to a
  // fully section-scoped representation.
  const sharedTail = allFree.includes(17) && allFree.includes(18) ? [17, 18] : undefined;
  const commonCandidates: number[][] = sharedTail ? [sharedTail, allFree, []] : [allFree, []];
  const plans = commonCandidates
    .filter((weeks, index, all) => all.findIndex(other => weekMask(other) === weekMask(weeks)) === index)
    .map(buildPlan)
    .filter((plan): plan is NotationPlan => plan !== undefined);
  const preferred = plans.reduce<NotationPlan | undefined>((best, plan) =>
    !best || plan.groupCount < best.groupCount ? plan : best
  , undefined);
  return preferred?.text ?? '';
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

function sc(cell: ExcelJS.Cell, font: Partial<ExcelJS.Font>, fill?: string) {
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
      titleCell.value = termName ? `${termName}朋辈反课表` : '朋辈反课表';
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

  async generateDepartmentStatsExcel(department: string, schedules: Schedule[]): Promise<Buffer> {
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

  async generatePersonScheduleExcel(personName: string, courses: Course[]): Promise<Buffer> {
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
