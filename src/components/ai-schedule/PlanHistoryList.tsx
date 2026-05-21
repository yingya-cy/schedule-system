import { useAiScheduleStore } from '../../stores/aiScheduleStore';
import PlanTimeline from './PlanTimeline';

export default function PlanHistoryList() {
  const plans = useAiScheduleStore((s) => s.plans);
  const plansLoading = useAiScheduleStore((s) => s.plansLoading);
  const selectedPlan = useAiScheduleStore((s) => s.selectedPlan);
  const fetchPlanDetail = useAiScheduleStore((s) => s.fetchPlanDetail);
  const generatedPlan = useAiScheduleStore((s) => s.generatedPlan);

  if (selectedPlan) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => useAiScheduleStore.setState({ selectedPlan: null, generatedPlan: null })}
          className="text-sm text-primary hover:underline"
        >
          ← 返回历史列表
        </button>
        {generatedPlan ? (
          <PlanTimeline plan={generatedPlan} />
        ) : (
          <div className="text-sm text-on-surface-variant">加载中...</div>
        )}
      </div>
    );
  }

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

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">历史计划</h3>
      {plans.map((plan) => {
        const planData = plan.plan_data;
        const weekCount = planData?.weekly_plans?.length || 0;
        const firstWeek = planData?.weekly_plans?.[0]?.week_start || '';
        const createdAt = plan.created_at ? new Date(plan.created_at).toLocaleDateString('zh-CN') : '';

        return (
          <button
            key={plan.id}
            onClick={() => fetchPlanDetail(plan.id)}
            className="w-full text-left p-3 rounded-xl border border-outline-variant/20 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-on-surface truncate">
                {firstWeek ? `${firstWeek} 起 · ` : ''}{weekCount}周计划
              </span>
              <span className="text-[11px] text-on-surface-variant shrink-0 ml-2">{createdAt}</span>
            </div>
            {planData?.summary && (
              <p className="text-xs text-on-surface-variant/70 mt-1 line-clamp-1">{planData.summary}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
