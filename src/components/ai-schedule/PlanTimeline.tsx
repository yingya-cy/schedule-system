import type { PlanData, DailyPlan, TimeBlock } from '../../services/aiScheduleApi';

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const TYPE_COLORS: Record<string, string> = {
  study: 'bg-primary/15 border-l-2 border-primary',
  class: 'bg-surface-container-high border-l-2 border-outline',
  activity: 'bg-warning/15 border-l-2 border-warning',
  break: 'bg-transparent border-l-2 border-transparent',
};
const PRIORITY_DOTS: Record<string, string> = {
  high: 'bg-error',
  medium: 'bg-warning',
  low: 'bg-outline',
};

export default function PlanTimeline({ plan }: { plan: PlanData }) {
  if (!plan.weekly_plans?.length) {
    return <div className="empty-state"><p className="empty-state-title">计划数据为空</p></div>;
  }

  const week = plan.weekly_plans[0];
  const days = week.daily_plans;

  // Collect all unique time slots for the grid rows
  const allTimes = new Set<string>();
  days.forEach((d: DailyPlan) => {
    d.time_blocks.forEach((b: TimeBlock) => {
      allTimes.add(b.start);
      allTimes.add(b.end);
    });
  });
  const timeSlots = Array.from(allTimes).sort();

  // Desktop: grid view
  return (
    <div>
      {/* Summary */}
      {plan.summary && (
        <p className="text-sm text-on-surface-variant mb-4 italic">{plan.summary}</p>
      )}

      {/* Desktop: 7-column grid */}
      <div className="hidden lg:block overflow-x-auto">
        <div className="grid grid-cols-7 gap-px bg-outline-variant/20 min-w-[700px]">
          {/* Day headers */}
          {days.map((d: DailyPlan) => (
            <div key={d.date} className="bg-surface-container-lowest px-2 py-2 text-center">
              <div className="text-xs font-semibold text-on-surface">{DAY_NAMES[d.day_of_week]}</div>
              <div className="text-[10px] text-on-surface-variant">{d.date.slice(5)}</div>
            </div>
          ))}

          {/* Time blocks */}
          {timeSlots.map((time) => (
            days.map((d: DailyPlan) => {
              const block = d.time_blocks.find((b: TimeBlock) => b.start === time);
              if (!block) return <div key={`${d.date}-${time}`} className="bg-surface-container-lowest h-1" />;

              // Estimate height from duration (30min = 2rem)
              const [sh, sm] = block.start.split(':').map(Number);
              const [eh, em] = block.end.split(':').map(Number);
              const mins = (eh * 60 + em) - (sh * 60 + sm);
              const heightRem = Math.max(mins / 30, 1) * 2;

              return (
                <div key={`${d.date}-${time}`} className="bg-surface-container-lowest px-1 py-0.5"
                  style={{ gridRow: `span ${Math.ceil(heightRem / 2)}` }}>
                  <div className={`rounded-md px-2 py-1 text-xs h-full ${TYPE_COLORS[block.type] || ''}`}>
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOTS[block.priority] || ''}`} />
                      <span className="font-medium text-on-surface truncate">{block.task}</span>
                    </div>
                    <div className="text-[10px] text-on-surface-variant mt-0.5">
                      {block.start}-{block.end}
                    </div>
                  </div>
                </div>
              );
            })
          ))}
        </div>
      </div>

      {/* Mobile: list view, tabs for days */}
      <div className="lg:hidden space-y-3">
        {days.map((d: DailyPlan) => (
          <div key={d.date} className="paper-card bg-surface p-3">
            <div className="text-sm font-semibold text-on-surface mb-2">
              {DAY_NAMES[d.day_of_week]} {d.date.slice(5)}
            </div>
            <div className="space-y-1">
              {d.time_blocks.map((b: TimeBlock, i: number) => (
                <div key={i} className={`rounded-md px-3 py-1.5 text-xs ${TYPE_COLORS[b.type] || ''}`}>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOTS[b.priority] || ''}`} />
                    <span className="font-medium">{b.start}-{b.end}</span>
                    <span className="text-on-surface">{b.task}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
