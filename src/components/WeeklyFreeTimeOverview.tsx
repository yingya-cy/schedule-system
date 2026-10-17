import { useMemo } from 'react';
import { CalendarDays, Moon, Sun, Sunset } from 'lucide-react';
import type { FreeTimeResult } from '@/types';
import { WEEKDAYS } from '@/types';
import { FREE_TIME_PERIODS, peopleForSections, sectionLabel, summarizePeriod } from '@/lib/freeTime';

interface Props {
  data: FreeTimeResult[];
  week: number;
  day: number;
  sections: number[];
  selected: boolean;
  loading: boolean;
  error: string;
  onWeekChange: (week: number) => void;
  onSelect: (day: number, sections: number[]) => void;
  onRetry: () => void;
}

export default function WeeklyFreeTimeOverview({ data, week, day, sections, selected, loading, error, onWeekChange, onSelect, onRetry }: Props) {
  const rows = useMemo(() => FREE_TIME_PERIODS.map(period => ({
    period,
    cells: WEEKDAYS.map((_, index) => {
      const summary = summarizePeriod(data, index + 1, period);
      return { ...summary, people: peopleForSections(data, index + 1, summary.sections) };
    }),
  })), [data]);
  const maxCount = Math.max(1, ...rows.flatMap(row => row.cells.map(cell => cell.count)));
  const period = FREE_TIME_PERIODS.find(item => sections.every(section => item.sections.some(value => value === section))) ?? FREE_TIME_PERIODS[0];
  const icons = [Sun, Sunset, Moon];
  const disabled = loading || Boolean(error);
  const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, index) => start + index);

  return (
    <section className="weekly-overview" aria-busy={loading}>
      <div className="weekly-toolbar">
        <h2 className="font-headline"><CalendarDays size={18} aria-hidden="true" />一周空闲地图</h2>
        <label className="weekly-week-label">周次
          <select aria-label="总览周次" value={week} onChange={event => onWeekChange(Number(event.target.value))}>
            {Array.from({ length: 18 }, (_, index) => <option key={index + 1} value={index + 1}>第{index + 1}周</option>)}
          </select>
        </label>
      </div>
      <div className="weekly-legend"><span>{loading ? '加载中...' : '空闲人数'}</span><span>少 <i className="weekly-legend-swatches" aria-hidden="true" /> 多</span></div>
      {error && <div role="alert" className="weekly-error"><span>{error}</span><button onClick={onRetry}>重试</button></div>}
      <div className="weekly-matrix">
        <span aria-hidden="true" />
        {WEEKDAYS.map(label => <span className="weekly-day" key={label}>{label}</span>)}
        {rows.map(({ period: rowPeriod, cells }, rowIndex) => {
          const Icon = icons[rowIndex];
          return <div className="weekly-matrix-row" key={rowPeriod.id}>
            <div className="weekly-period"><Icon size={15} aria-hidden="true" /><span>{rowPeriod.label}</span></div>
            {cells.map((cell, index) => {
              const active = selected && day === index + 1 && period.id === rowPeriod.id;
              const level = cell.count ? Math.max(1, Math.ceil(cell.count / maxCount * 4)) : 0;
              return <button key={index} className="weekly-cell" data-day={index + 1} data-period={rowPeriod.id} data-level={disabled ? 0 : level}
                aria-pressed={active} disabled={disabled}
                aria-label={disabled ? `${WEEKDAYS[index]}${rowPeriod.label}，${loading ? '正在加载' : '加载失败'}` : `${WEEKDAYS[index]}${rowPeriod.label}，${rowPeriod.id === 'night' ? '整段' : '最多'}${cell.count}人空闲，${sectionLabel(cell.sections)}${cell.count ? `，${cell.people.slice(0, 3).map(person => `${person.name}（${person.department}）`).join('、')}${cell.count > 3 ? `，另有${cell.count - 3}人` : ''}` : ''}`}
                onClick={() => onSelect(index + 1, cell.sections)}>
                <span className="weekly-cell-section">{disabled ? '-' : rowPeriod.id === 'night' ? '9-11节' : sectionLabel(cell.sections)}</span>
                <span className="weekly-cell-names">
                  {disabled ? <span className="weekly-cell-empty">-</span> : cell.count ? <>
                    {cell.people.slice(0, 3).map(person => <span className="weekly-cell-person" key={JSON.stringify([person.name, person.department])} title={`${person.name} · ${person.department}`}>{person.name}</span>)}
                    {cell.count > 3 && <span className="weekly-more-desktop">+{cell.count - 3}人</span>}
                    {cell.count > 2 && <span className="weekly-more-mobile">+{cell.count - 2}人</span>}
                  </> : <span className="weekly-cell-empty">暂无</span>}
                </span>
                <span className="weekly-cell-kind">{disabled ? '-' : `${rowPeriod.id === 'night' ? '整段' : '最多'}${cell.count}人`}</span>
              </button>;
            })}
          </div>;
        })}
      </div>
      {selected && !disabled && <div className="weekly-detail">
        <div className="weekly-detail-heading"><h3>{WEEKDAYS[day - 1]} · {period.label}</h3><span>{sectionLabel(sections)} · {peopleForSections(data, day, sections).length} 人共同空闲</span></div>
        {period.id !== 'night' && <>
          <div className="weekly-section-buttons">
            {period.sections.map(section => <button key={section} aria-pressed={sections.includes(section)} onClick={() => onSelect(day, [section])}>
              <span>第{section}节</span><strong>{peopleForSections(data, day, [section]).length}<small> 人</small></strong>
            </button>)}
          </div>
          <div className="weekly-range">
            <label>开始节次<select aria-label="总览开始节次" value={sections[0]} onChange={event => {
              const start = Number(event.target.value); onSelect(day, range(start, Math.max(start, sections[sections.length - 1])));
            }}>{period.sections.map(section => <option key={section} value={section}>第{section}节</option>)}</select></label>
            <span aria-hidden="true">-</span>
            <label>结束节次<select aria-label="总览结束节次" value={sections[sections.length - 1]} onChange={event => onSelect(day, range(sections[0], Number(event.target.value)))}>
              {period.sections.map(section => <option key={section} value={section} disabled={section < sections[0]}>第{section}节</option>)}
            </select></label>
          </div>
        </>}
      </div>}
    </section>
  );
}
