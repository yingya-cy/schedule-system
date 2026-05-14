import { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { useAiScheduleStore } from '../../stores/aiScheduleStore';
import CommitmentForm from './CommitmentForm';
import type { Commitment } from './CommitmentForm';
import PlanTimeline from './PlanTimeline';

type Step = 'select-term' | 'add-commitments' | 'view-plan' | 'history';

export default function AiSchedulePage() {
  const terms = useAppStore((s) => s.availableTerms);
  const refreshTerms = useAppStore((s) => s.refreshTerms);
  const schedules = useAppStore((s) => s.schedules);
  const refreshSchedules = useAppStore((s) => s.refreshSchedules);
  const schedulesLoading = useAppStore((s) => s.schedulesLoading);
  const user = useAuthStore((s) => s.user);

  const generatedPlan = useAiScheduleStore((s) => s.generatedPlan);
  const generating = useAiScheduleStore((s) => s.generating);
  const generateError = useAiScheduleStore((s) => s.generateError);
  const generatePlan = useAiScheduleStore((s) => s.generatePlan);
  const plans = useAiScheduleStore((s) => s.plans);
  const plansLoading = useAiScheduleStore((s) => s.plansLoading);
  const fetchPlans = useAiScheduleStore((s) => s.fetchPlans);
  const clearGenerated = useAiScheduleStore((s) => s.clearGenerated);
  const deletePlan = useAiScheduleStore((s) => s.deletePlan);

  const [step, setStep] = useState<Step>('select-term');
  const [termId, setTermId] = useState<number | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);

  useEffect(() => {
    refreshTerms();
    fetchPlans();
  }, []);

  const handleSelectTerm = async (id: number) => {
    setTermId(id);
    await refreshSchedules();
    setStep('add-commitments');
  };

  // Filter schedules by selected term (term_id may be in DB but not in frontend type)
  const currentTermSchedules = schedules;
  const hasCourses = schedules.some((s) => s.courses && s.courses.length > 0);

  const getNextMonday = () => {
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    return d.toISOString().slice(0, 10);
  };

  const handleGenerate = async () => {
    if (!hasCourses) return;
    const courses = schedules.flatMap((s) =>
      (s.courses || []).map((c) => ({
        name: c.course_name,
        weekday: c.weekday,
        sections: c.sections,
        weeks: c.weeks,
        teacher: c.teacher || '',
        location: c.location || '',
      }))
    );

    const formattedCommitments = commitments.map((c) => ({
      name: c.name,
      date: c.date,
      start_time: c.start,
      end_time: c.end,
      priority: c.priority,
    }));

    await generatePlan({
      courses,
      commitments: formattedCommitments,
      grade: user?.grade || undefined,
      major: user?.major || undefined,
      next_monday: getNextMonday(),
      term_id: termId || undefined,
    });
    setStep('view-plan');
  };

  const renderStep = () => {
    switch (step) {
      case 'select-term':
        return (
          <div className="space-y-4 max-w-md">
            <h3 className="font-semibold text-on-surface">选择学期</h3>
            {terms.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">暂无学期</p>
                <p className="empty-state-description">请先创建学期和课表</p>
              </div>
            ) : (
              <div className="space-y-2">
                {terms.filter((t) => t.status === 'active').map((t) => (
                  <button key={t.id} onClick={() => handleSelectTerm(t.id)}
                    className="w-full paper-card bg-surface p-4 text-left hover:shadow-md transition-shadow">
                    <span className="font-medium text-on-surface">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
            {plans.length > 0 && (
              <button onClick={() => { fetchPlans(); setStep('history'); }}
                className="text-sm text-primary hover:underline">
                查看历史计划 ({plans.length})
              </button>
            )}
          </div>
        );

      case 'add-commitments':
        return (
          <div className="space-y-4 max-w-3xl">
            <button onClick={() => setStep('select-term')} className="text-sm text-primary hover:underline">
              &larr; 重新选择学期
            </button>
            <h3 className="font-semibold text-on-surface">添加事项</h3>
            {hasCourses ? (
              <>
                <p className="text-sm text-on-surface-variant">
                  已选学期有 {currentTermSchedules.length} 个课表，共{' '}
                  {currentTermSchedules.reduce((sum, s) => sum + (s.courses?.length || 0), 0)} 门课程
                </p>
                <CommitmentForm items={commitments} onChange={setCommitments} />
                <button onClick={handleGenerate} disabled={generating}
                  className="btn-primary px-6 py-2.5 text-sm">
                  {generating ? 'AI 正在分析你的课表...' : '生成学习计划'}
                </button>
              </>
            ) : (
              <div className="empty-state">
                <p className="empty-state-title">该学期暂无课表</p>
                <p className="empty-state-description">请先去课表中心上传课表</p>
              </div>
            )}
          </div>
        );

      case 'view-plan':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { clearGenerated(); setStep('add-commitments'); }}
                className="text-sm text-primary hover:underline">
                &larr; 返回修改事项
              </button>
              <button onClick={() => { clearGenerated(); setCommitments([]); setStep('select-term'); }}
                className="text-sm text-primary hover:underline">
                开始新计划
              </button>
            </div>

            {generating && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="animate-spin w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full" />
                <p className="text-on-surface-variant text-sm">AI 正在分析你的课表，预计 10-30 秒...</p>
              </div>
            )}

            {generateError && (
              <div className="px-4 py-3 bg-error/10 text-error rounded-lg text-sm">
                {generateError}
                <button onClick={handleGenerate} className="ml-3 underline">重试</button>
              </div>
            )}

            {generatedPlan && !generating && (
              <>
                <PlanTimeline plan={generatedPlan} />
                <button onClick={handleGenerate} className="btn-secondary text-sm px-4 py-2">
                  重新生成
                </button>
              </>
            )}
          </div>
        );

      case 'history':
        return (
          <div className="space-y-4 max-w-2xl">
            <button onClick={() => setStep('select-term')} className="text-sm text-primary hover:underline">
              &larr; 返回
            </button>
            <h3 className="font-semibold text-on-surface">历史计划</h3>
            {plansLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
            ) : plans.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-title">还没有生成过计划</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plans.map((p) => (
                  <div key={p.id} className="paper-card bg-surface p-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-on-surface">
                        {p.plan_data?.summary?.slice(0, 60) || '计划'}...
                      </span>
                      <span className="text-xs text-on-surface-variant block">
                        {new Date(p.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <button onClick={() => deletePlan(p.id)} className="text-xs text-error hover:underline">删除</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <h2 className="text-xl font-bold text-on-surface font-headline mb-4">AI 日程安排</h2>
      {renderStep()}
    </div>
  );
}
