import { describe, it, expect } from 'vitest';
import excelExportService, { formatWeekGroups, detectParity, formatWeeks } from '@/services/excelExportService';

describe('detectParity', () => {
  it('returns 单 for all-odd weeks', () => {
    expect(detectParity([1, 3, 5, 7, 9])).toBe('单');
    expect(detectParity([11, 13, 15])).toBe('单');
    expect(detectParity([17])).toBe('单');
  });

  it('returns 双 for all-even weeks', () => {
    expect(detectParity([2, 4, 6, 8, 10])).toBe('双');
    expect(detectParity([12, 14, 16, 18])).toBe('双');
    expect(detectParity([2])).toBe('双');
  });

  it('returns empty for mixed parity', () => {
    expect(detectParity([1, 2, 3])).toBe('');
    expect(detectParity([1, 4, 7])).toBe('');
  });

  it('returns empty for empty array', () => {
    expect(detectParity([])).toBe('');
  });
});

describe('formatWeekGroups', () => {
  describe('consecutive weeks (step=1)', () => {
    it('groups consecutive numbers', () => {
      expect(formatWeekGroups([1, 2, 3, 4, 5])).toBe('(1-5)');
    });

    it('handles multiple groups separated by /', () => {
      expect(formatWeekGroups([1, 2, 3, 7, 8, 9])).toBe('(1-3)/(7-9)');
    });

    it('handles single weeks', () => {
      expect(formatWeekGroups([5])).toBe('(5)');
    });

    it('handles mixed single and ranges', () => {
      expect(formatWeekGroups([1, 2, 5])).toBe('(1-2)/(5)');
    });
  });

  describe('same-parity weeks (step=2)', () => {
    it('compresses all-odd sequential weeks', () => {
      expect(formatWeekGroups([1, 3, 5, 7, 9, 11, 13, 15, 17])).toBe('(1-17)');
    });

    it('compresses all-even sequential weeks', () => {
      expect(formatWeekGroups([2, 4, 6, 8, 10, 12, 14, 16, 18])).toBe('(2-18)');
    });

    it('compresses odd weeks with gaps', () => {
      expect(formatWeekGroups([3, 5, 7, 9, 11, 13, 15])).toBe('(3-15)');
    });

    it('compresses even weeks with gaps', () => {
      expect(formatWeekGroups([2, 4, 6, 10, 12, 14])).toBe('(2-6)/(10-14)');
    });

    it('handles single odd week', () => {
      expect(formatWeekGroups([7])).toBe('(7)');
    });

    it('handles single even week', () => {
      expect(formatWeekGroups([8])).toBe('(8)');
    });
  });

  describe('mixed parity (step=1 fallback)', () => {
    it('groups mixed weeks normally', () => {
      expect(formatWeekGroups([1, 2, 3, 4])).toBe('(1-4)');
    });

    it('does not compress step=2 when parity mixed', () => {
      // 1(odd), 3(odd), 4(even) → mixed, step=1, gap between 1 and 3-4
      expect(formatWeekGroups([1, 3, 4])).toBe('(1)/(3-4)');
    });
  });

  it('returns empty for empty array', () => {
    expect(formatWeekGroups([])).toBe('');
  });
});

describe('formatWeeks', () => {
  it('returns empty for empty array', () => {
    expect(formatWeeks([])).toBe('');
  });

  it('formats all-odd with 单 prefix', () => {
    expect(formatWeeks([1, 3, 5, 7, 9, 11, 13, 15, 17])).toBe('单(1-17)');
  });

  it('formats all-even with 双 prefix', () => {
    expect(formatWeeks([2, 4, 6, 8, 10, 12, 14, 16, 18])).toBe('双(2-18)');
  });

  it('formats consecutive weeks without parity prefix', () => {
    expect(formatWeeks([1, 2, 3, 4, 5])).toBe('(1-5)');
  });

  it('handles single week without parity prefix', () => {
    expect(formatWeeks([3])).toBe('(3)');
    expect(formatWeeks([4])).toBe('(4)');
  });

  it('compresses odd run + single even outlier', () => {
    expect(formatWeeks([1, 3, 5, 7, 9, 11, 13, 15, 17, 18])).toBe('单(1-17)/(18)');
  });

  it('puts parity-prefixed run first', () => {
    expect(formatWeeks([1, 2, 4, 6, 8, 10, 12, 14, 16, 18])).toBe('双(4-18)/(1-2)');
  });

  it('handles two consecutive numbers without parity prefix', () => {
    expect(formatWeeks([17, 18])).toBe('(17-18)');
  });

  it('handles multiple parity runs with single /', () => {
    expect(formatWeeks([1, 3, 5, 7, 9, 12, 14, 16, 17])).toBe('单(1-9)双(12-16)/(17)');
  });
});

describe('generateReverseScheduleWorkbook', () => {
  it('uses chronological week groups without parity labels for section-specific cells', async () => {
    const workbook = await excelExportService.generateReverseScheduleWorkbook({
      departments: ['Test Department'],
      people: [{
        name: 'Parity Student',
        department: 'Test Department',
        courses: [
          {
            weekday: 1,
            sections: [5],
            weeks: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17],
          },
          {
            weekday: 1,
            sections: [6],
            weeks: [3, 5],
          },
        ],
      }],
    });

    const monday = workbook.getWorksheet('星期一');
    expect(monday).toBeDefined();
    expect(monday!.getCell('J4').value).toBe(
      'Parity Student6(2)(4)(6-12)(15-17)/(1)(13-14)(18)'
    );
  });

  it('keeps slashes between week groups in ordinary cells', async () => {
    const workbook = await excelExportService.generateReverseScheduleWorkbook({
      departments: ['Test Department'],
      people: [{
        name: 'Grouped Student',
        department: 'Test Department',
        courses: [{
          weekday: 1,
          sections: [1, 2],
          weeks: [4, 5, 6],
        }],
      }],
    });

    const monday = workbook.getWorksheet('星期一');
    expect(monday).toBeDefined();
    expect(monday!.getCell('B4').value).toBe('Grouped Student(1-3)/(7-18)');
  });

  it('uses the supplied term name directly in the workbook title', async () => {
    const workbook = await excelExportService.generateReverseScheduleWorkbook({
      departments: [],
      people: [],
    }, '白云第十四届第一学期');

    expect(workbook.getWorksheet('星期一')!.getCell('A1').value).toBe(
      '白云第十四届第一学期朋辈反课表'
    );
  });
});
