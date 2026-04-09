export const getWeekdayName = (day: any): string => {
  if (typeof day === 'number') {
    return ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'][day - 1] || '时间待定';
  }
  return day || '时间待定';
};

export const formatSection = (section: any): string => {
  if (Array.isArray(section)) {
    if (section.length === 0) return '';
    return `${section[0]}-${section[section.length - 1]}节`;
  }
  return section || '';
};

export const formatWeekInfo = (week: any): string => {
  if (!week) return '未指定';
  if (typeof week === 'string') {
    return week;
  }
  if (Array.isArray(week) && week.length > 0) {
    return `${week[0]}-${week[week.length - 1]}周`;
  }
  if (week.type === 'range') {
    let suffix = '';
    if (week.rule === 'odd') suffix = '(单周)';
    if (week.rule === 'even') suffix = '(双周)';
    return `${week.start}-${week.end}周${suffix}`;
  }
  if (week.type === 'multi_range' && week.ranges) {
    return week.ranges.map((r: any) => `${r.start}-${r.end}`).join(',') + '周';
  }
  if (week.type === 'list' && week.weeks) {
    return `第${week.weeks.join(',')}周`;
  }
  return JSON.stringify(week);
};
