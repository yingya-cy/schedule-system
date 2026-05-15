import { useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAiScheduleStore } from '../../stores/aiScheduleStore';
import CommitmentForm from './CommitmentForm';
import type { Commitment } from './CommitmentForm';
import PlanTimeline from './PlanTimeline';
import { aiScheduleApi } from '../../services/aiScheduleApi';

type Step = 'upload' | 'commitments' | 'plan' | 'history';

export default function AiSchedulePage() {
  const user = useAuthStore((s) => s.user);
  const generatedPlan = useAiScheduleStore((s) => s.generatedPlan);
  const generating = useAiScheduleStore((s) => s.generating);
  const generateError = useAiScheduleStore((s) => s.generateError);
  const generatePlan = useAiScheduleStore((s) => s.generatePlan);
  const plans = useAiScheduleStore((s) => s.plans);
  const plansLoading = useAiScheduleStore((s) => s.plansLoading);
  const fetchPlans = useAiScheduleStore((s) => s.fetchPlans);
  const clearGenerated = useAiScheduleStore((s) => s.clearGenerated);

  const [step, setStep] = useState<Step>('upload');
  const [courses, setCourses] = useState<{
    course_name: string; weekday: number; sections: number[];
    weeks: number[]; teacher?: string; location?: string;
  }[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getNextMonday = () => {
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    return d.toISOString().slice(0, 10);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');

    try {
      const token = useAuthStore.getState().token;
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ai/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '识别失败');

      setCourses(data.data.courses || []);
      setStep('commitments');
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (courses.length === 0) return;

    const formattedCommitments = commitments.map((c) => ({
      name: c.name,
      date: c.date,
      start_time: c.start,
      end_time: c.end,
      priority: c.priority,
    }));

    await generatePlan({
      courses: courses.map((c) => ({
        name: c.course_name,
        weekday: c.weekday,
        sections: c.sections,
        weeks: c.weeks,
        teacher: c.teacher || '',
        location: c.location || '',
      })),
      commitments: formattedCommitments,
      grade: user?.grade || undefined,
      major: user?.major || undefined,
      next_monday: getNextMonday(),
    });
    setStep('plan');
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
      <div className="overflow-y-auto scrollbar-thin p-4 lg:p-8 flex-1">
        <style>{`
          .scrollbar-thin::-webkit-scrollbar { width: 4px; }
          .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
          .scrollbar-thin::-webkit-scrollbar-thumb { background: rgb(var(--outline-variant)/.3); border-radius: 2px; }
          .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgb(var(--outline)/.4); }
        `}</style>
        <h2 className="text-xl font-bold text-on-surface font-headline mb-4">AI 日程安排</h2>

        {/* Step indicator */}
        <div className="flex gap-2 mb-6 text-sm">
          {(['upload', 'commitments', 'plan'] as Step[]).map((s, i) => (
            <span key={s} className={`flex items-center gap-1 ${step === s ? 'text-primary font-semibold' : 'text-outline'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === s ? 'bg-primary text-on-primary' : 'bg-surface-container-low'}`}>{i + 1}</span>
              {s === 'upload' ? '上传课表' : s === 'commitments' ? '添加事项' : '查看计划'}
              {i < 2 && <span className="text-outline mx-1">&rarr;</span>}
            </span>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="max-w-lg space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${uploading ? 'border-primary bg-primary/5 pointer-events-none' : 'border-outline-variant hover:border-primary hover:bg-primary/5'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="space-y-3">
                  <div className="mx-auto w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-on-surface-variant">正在识别课表...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl">+</div>
                  <div>
                    <p className="text-on-surface font-medium">点击上传课表</p>
                    <p className="text-xs text-on-surface-variant mt-1">支持 JPG、PNG、PDF 格式</p>
                  </div>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFile} className="hidden" />
            </div>
            {uploadError && (
              <div className="p-3 bg-error/10 text-error rounded-lg text-sm flex items-center justify-between">
                <span>{uploadError}</span>
                <button onClick={() => setUploadError('')} className="font-bold">&times;</button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Courses + Commitments */}
        {step === 'commitments' && (
          <div className="space-y-4 max-w-3xl">
            <button onClick={() => { clearGenerated(); setStep('upload'); setCourses([]); }} className="text-sm text-primary hover:underline">
              &larr; 重新上传
            </button>

            {/* Course summary */}
            <div className="paper-card bg-surface space-y-2">
              <h3 className="font-semibold text-on-surface">识别到 {courses.length} 门课程</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                {courses.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-surface-container-low">
                    <span className="text-on-surface">{c.course_name}</span>
                    <span className="text-xs text-on-surface-variant">
                      周{c.weekday} 第{c.sections?.join(',')}节
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Commitments */}
            <CommitmentForm items={commitments} onChange={setCommitments} />

            <button onClick={handleGenerate} disabled={generating}
              className="btn-primary px-6 py-2.5 text-sm">
              {generating ? 'AI 正在分析你的课表...' : '生成学习计划'}
            </button>
            {generateError && <p className="text-sm text-error">{generateError}</p>}

            <button onClick={() => { fetchPlans(); setStep('history'); }} className="text-sm text-primary hover:underline block mt-2">
              查看历史计划
            </button>
          </div>
        )}

        {/* Step 3: View Plan */}
        {step === 'plan' && (
          <div className="space-y-4 max-w-4xl">
            <button onClick={() => { clearGenerated(); setStep('commitments'); }} className="text-sm text-primary hover:underline">
              &larr; 返回调整事项
            </button>
            {generateError ? (
              <div className="p-4 bg-error/10 text-error rounded-lg text-sm">{generateError}</div>
            ) : generatedPlan ? (
              <PlanTimeline plan={generatedPlan} />
            ) : (
              <div className="p-4 text-sm text-on-surface-variant">正在加载计划...</div>
            )}
          </div>
        )}

        {/* History */}
        {step === 'history' && (
          <div className="space-y-4 max-w-3xl">
            <button onClick={() => setStep('upload')} className="text-sm text-primary hover:underline">
              &larr; 返回
            </button>
            <h3 className="font-semibold text-on-surface">历史计划</h3>
            {plansLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
            ) : plans.length === 0 ? (
              <p className="text-sm text-on-surface-variant">还没有生成过计划</p>
            ) : (
              <div className="space-y-2">
                {plans.map((p) => (
                  <button key={p.id} onClick={() => { useAiScheduleStore.setState({ generatedPlan: p.plan_data }); setStep('plan'); }}
                    className="w-full text-left paper-card bg-surface p-4 hover:shadow-md transition-shadow">
                    <span className="font-medium text-on-surface">{p.created_at ? new Date(p.created_at).toLocaleDateString('zh-CN') : '-'} 的计划</span>
                    <button onClick={(e) => { e.stopPropagation(); useAiScheduleStore.getState().deletePlan(p.id); }}
                      className="float-right text-xs text-error hover:underline">删除</button>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
