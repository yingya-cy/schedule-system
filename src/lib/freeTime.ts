import type { FreeTimeResult } from '@/types';

export const FREE_TIME_PERIODS = [
  { id: 'morning', label: '上午', sections: [1, 2, 3, 4] },
  { id: 'afternoon', label: '下午', sections: [5, 6, 7, 8] },
  { id: 'night', label: '晚上', sections: [9, 10, 11] },
] as const;
export type FreeTimePeriod = typeof FREE_TIME_PERIODS[number];

export function peopleForSections(data: FreeTimeResult[], day: number, sections: readonly number[]) {
  if (!sections.length) return [];
  const lists = sections.map(section => data.find(row => row.day === day && row.section === section)?.free_people ?? []);
  const key = (person: { name: string; department: string }) => JSON.stringify([person.name, person.department]);
  const others = lists.slice(1).map(list => new Set(list.map(key)));
  const seen = new Set<string>();
  return lists[0].filter(person => {
    const id = key(person);
    if (seen.has(id) || !others.every(set => set.has(id))) return false;
    seen.add(id);
    return true;
  });
}

export function summarizePeriod(data: FreeTimeResult[], day: number, period: FreeTimePeriod) {
  if (period.id === 'night') {
    return { count: peopleForSections(data, day, period.sections).length, sections: [...period.sections] };
  }
  // A daytime peak is a single real section, never the union of different people's availability.
  return period.sections.reduce((best, section) => {
    const count = peopleForSections(data, day, [section]).length;
    return count > best.count ? { count, sections: [section] } : best;
  }, { count: 0, sections: [period.sections[0] as number] });
}

export function sectionLabel(sections: readonly number[]) {
  return sections.length === 1 ? `第${sections[0]}节` : `第${sections[0]}-${sections[sections.length - 1]}节`;
}
