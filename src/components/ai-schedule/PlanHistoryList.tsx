import { useState } from 'react';
import { useAiScheduleStore } from '../../stores/aiScheduleStore';

export default function PlanHistoryList() {
  const plans = useAiScheduleStore((s) => s.plans);
  const plansLoading = useAiScheduleStore((s) => s.plansLoading);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (plansLoading) {
    return <div className="text-sm text-on-surface-variant py-4">加载历史记录...</div>;
  }

  if (plans.length === 0) {
    return (
      <div className="text-sm text-on-surface-variant/60 py-4 text-center">
        暂无历史计划，生成第一个 AI 计划吧
      </div>
    );
  }

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">历史计划</h3>
      {plans.map((plan) => {
        const planData = plan.plan_data;
        const weekCount = planData?.weekly_plans?.length || 0;
        const firstWeek = planData?.weekly_plans?.[0]?.week_start || '';
        const createdAt = plan.created_at ? new Date(plan.created_at).toLocaleDateString('zh-CN') : '';
        const isExpanded = expandedId === plan.id;

        return (
          <div
            key={plan.id}
            className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors"
          >
            <button
              onClick={() => toggleExpand(plan.id)}
              className="w-full text-left p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-on-surface truncate">
                  {firstWeek ? `${firstWeek} 起 · ` : ''}{weekCount}周计划
                </span>
                <span className="text-[11px] text-on-surface-variant shrink-0 ml-2">{createdAt}</span>
              </div>
              {planData?.summary && (
                <p className={`text-xs text-on-surface-variant/70 mt-1 ${isExpanded ? '' : 'line-clamp-1'}`}>
                  {planData.summary}
                </p>
              )}
            </button>

            {isExpanded && planData?.weekly_plans && (
              <div className="px-3 pb-3 border-t border-outline-variant/10 pt-2 space-y-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(plan.id);
                  }}
                  className="text-[11px] text-primary hover:underline"
                >
                  收起
                </button>
                {planData.weekly_plans.map((wp, wi) => (
                  <div key={wi}>
                    <p className="text-[11px] font-semibold text-on-surface mb-1">{wp.week_start}</p>
                    <div className="space-y-0.5">
                      {wp.daily_plans?.map((dp, di) => (
                        <div key={di} className="text-[11px] text-on-surface-variant flex gap-2">
                          <span className="text-outline w-8 shrink-0">
                            {['一','二','三','四','五','六','日'][dp.day_of_week - 1]}
                          </span>
                          <span className="truncate">{dp.time_blocks?.[0]?.task || '自由安排'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
