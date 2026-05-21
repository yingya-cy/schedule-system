import { useAiScheduleStore } from '../../stores/aiScheduleStore';

interface PlanHistoryListProps {
  onSelect: (id: number) => void;
}

export default function PlanHistoryList({ onSelect }: PlanHistoryListProps) {
  const plans = useAiScheduleStore((s) => s.plans);
  const plansLoading = useAiScheduleStore((s) => s.plansLoading);

  if (plansLoading) {
    return <div className="text-xs text-on-surface-variant py-2">加载中...</div>;
  }

  if (plans.length === 0) {
    return <div className="text-xs text-on-surface-variant/60 py-2">暂无历史计划</div>;
  }

  return (
    <div className="space-y-1.5">
      {plans.map((plan) => {
        const planData = plan.plan_data;
        const weekCount = planData?.weekly_plans?.length || 0;
        const firstWeek = planData?.weekly_plans?.[0]?.week_start || '';
        const createdAt = plan.created_at ? new Date(plan.created_at).toLocaleDateString('zh-CN') : '';

        return (
          <button
            key={plan.id}
            onClick={() => onSelect(plan.id)}
            className="w-full text-left p-2.5 rounded-lg border border-outline-variant/20 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-on-surface truncate">
                {firstWeek ? `${firstWeek} 起 · ` : ''}{weekCount}周
              </span>
              <span className="text-[10px] text-outline shrink-0 ml-2">{createdAt}</span>
            </div>
            {planData?.summary && (
              <p className="text-[11px] text-on-surface-variant/60 mt-0.5 line-clamp-1 group-hover:text-on-surface-variant/80">
                {planData.summary}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
