import { useState } from 'react';
import type { PlanData, DailyPlan, TimeBlock } from '../../services/aiScheduleApi';

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const TYPE_STYLES: Record<string, { bg: string; bar: string; label: string }> = {
  study:    { bg: 'bg-primary/8', bar: 'bg-primary', label: '自习' },
  class:    { bg: 'bg-surface-container-high/60', bar: 'bg-outline', label: '上课' },
  activity: { bg: 'bg-warning/8', bar: 'bg-warning', label: '活动' },
  break:    { bg: 'bg-transparent', bar: 'bg-transparent', label: '休息' },
};
const PRIORITY_BADGES: Record<string, string> = {
  high: 'bg-error/15 text-error',
  medium: 'bg-warning/15 text-warning',
  low: 'bg-surface-container-high text-on-surface-variant',
};

function TimeBlockRow({ b }: { b: TimeBlock }) {
  const [expanded, setExpanded] = useState(false);
  const s = TYPE_STYLES[b.type] || TYPE_STYLES.study;
  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg ${s.bg} border-l-2 ${s.bar} hover:brightness-95 transition-all cursor-pointer`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium text-on-surface ${expanded ? '' : 'truncate'}`}>{b.task}</span>
          {b.priority === 'high' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-error/15 text-error">核心</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-on-surface-variant">
          <span className="font-mono">{b.start}-{b.end}</span>
          <span>{s.label}</span>
        </div>
        {b.note && <p className="text-[10px] text-outline mt-0.5">{b.note}</p>}
      </div>
    </button>
  );
}

function DayCard({ day, isToday }: { day: DailyPlan; isToday: boolean }) {
  const dn = DAY_NAMES[day.day_of_week] || '';
  const dateLabel = day.date.slice(5);
  const hasContent = day.time_blocks.length > 0;

  return (
    <div className={`rounded-xl border ${isToday ? 'border-primary/40 bg-primary/3' : 'border-outline-variant/30 bg-surface-container-lowest'} overflow-hidden`}>
      <div className={`px-3 py-2.5 border-b ${isToday ? 'border-primary/20 bg-primary/5' : 'border-outline-variant/20'} text-center`}>
        <div className="text-sm font-bold text-on-surface">{dn}</div>
        <div className={`text-[11px] ${isToday ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>{dateLabel}</div>
      </div>
      <div className="p-2 space-y-1.5 min-h-[60px]">
        {hasContent ? (
          day.time_blocks.map((b, i) => <TimeBlockRow key={i} b={b} />)
        ) : (
          <p className="text-[11px] text-outline text-center py-4">无安排</p>
        )}
      </div>
    </div>
  );
}

export default function PlanTimeline({ plan, compact }: { plan: PlanData; compact?: boolean }) {
  if (!plan.weekly_plans?.length) {
    return <div className="empty-state"><p className="empty-state-title">计划数据为空</p><p className="empty-state-desc">上传课表后点击"生成学习计划"</p></div>;
  }

  const week = plan.weekly_plans[0];
  const days = week.daily_plans;
  const today = new Date().toISOString().slice(0, 10);
  const gridCols = compact
    ? 'grid-cols-1 sm:grid-cols-2'
    : 'grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7';

  return (
    <div className="space-y-4">
      {plan.summary && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">本周概览</p>
          <p className="text-sm text-on-surface">{plan.summary}</p>
        </div>
      )}

      <div className={`grid ${gridCols} gap-2`}>
        {days.map((d) => (
          <DayCard key={d.date} day={d} isToday={d.date === today} />
        ))}
      </div>
    </div>
  );
}
