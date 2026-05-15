import { useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAiScheduleStore } from '../../stores/aiScheduleStore';
import type { EditableCourse } from '../../types';
import ScheduleEditor from '../ScheduleEditor';
import CommitmentForm from './CommitmentForm';
import type { Commitment } from './CommitmentForm';
import PlanTimeline from './PlanTimeline';

type Step = 'upload' | 'edit-courses' | 'commitments' | 'plan' | 'history';

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
  const deletePlan = useAiScheduleStore((s) => s.deletePlan);

  const [step, setStep] = useState<Step>('upload');
  const [courses, setCourses] = useState<EditableCourse[]>([]);
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

      const recognized = data.data.courses || [];
      if (recognized.length === 0) {
        setUploadError('未能识别到课程，请尝试更清晰的图片');
        return;
      }

      setCourses(recognized);
      setStep('edit-courses');
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
      <style>{`
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgb(var(--outline-variant)/.3); border-radius: 2px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgb(var(--outline)/.4); }
      `}</style>

      {step === 'upload' ? (
        /* ====== Step 1: Upload ====== */
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg w-full space-y-4 text-center">
            <h2 className="text-xl font-bold text-on-surface font-headline">AI 日程安排</h2>
            <p className="text-sm text-on-surface-variant">上传课表图片或 PDF，AI 将自动识别课程并生成学习计划</p>

            <div
              className={`border-2 border-dashed rounded-xl p-16 cursor-pointer transition-colors ${uploading ? 'border-primary bg-primary/5 pointer-events-none' : 'border-outline-variant hover:border-primary hover:bg-primary/5'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="space-y-3">
                  <div className="mx-auto w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-on-surface-variant">正在识别课表...</p>
                  <p className="text-xs text-outline">AI 正在分析图片中的课程信息</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl">+</div>
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
                <button onClick={() => { setUploadError(''); setStep('upload'); }} className="font-bold">&times;</button>
              </div>
            )}

            <button onClick={() => { fetchPlans(); setStep('history'); }} className="text-sm text-primary hover:underline">
              查看历史计划
            </button>
          </div>
        </div>
      ) : (
        /* ====== Steps 2-4: full layout ====== */
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6 space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <button onClick={() => { clearGenerated(); setStep('upload'); setCourses([]); }} className="hover:text-primary">上传</button>
              <span>&rarr;</span>
              <button onClick={() => setStep('edit-courses')} className={`hover:text-primary ${step === 'edit-courses' ? 'text-primary font-semibold' : ''}`}>课表</button>
              <span>&rarr;</span>
              <button onClick={() => setStep('commitments')} className={`hover:text-primary ${step === 'commitments' ? 'text-primary font-semibold' : ''}`}>事项</button>
              <span>&rarr;</span>
              <button onClick={() => step === 'plan' && setStep('plan')} className={`hover:text-primary ${step === 'plan' ? 'text-primary font-semibold' : ''}`}>计划</button>
            </div>

            {/* Step 2: Edit recognized courses */}
            {step === 'edit-courses' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-on-surface">识别到 {courses.length} 门课程 — 可拖拽调整</h3>
                <ScheduleEditor
                  courses={courses}
                  onCoursesChange={setCourses}
                  onCancel={() => { setStep('upload'); setCourses([]); }}
                />
                <div className="flex gap-2">
                  <button onClick={() => { setStep('upload'); setCourses([]); }} className="btn-outline px-4 py-2 text-sm">
                    重新上传
                  </button>
                  <button onClick={() => setStep('commitments')} className="btn-primary px-6 py-2 text-sm">
                    确认课表，添加事项
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Commitments + Generate */}
            {step === 'commitments' && (
              <div className="space-y-4 max-w-2xl">
                <h3 className="font-semibold text-on-surface">添加事项</h3>
                <p className="text-sm text-on-surface-variant">课表已有 {courses.length} 门课程</p>
                <CommitmentForm items={commitments} onChange={setCommitments} />
                <button onClick={handleGenerate} disabled={generating}
                  className="btn-primary px-6 py-2.5 text-sm">
                  {generating ? 'AI 正在分析你的课表...' : '生成学习计划'}
                </button>
                {generateError && <p className="text-sm text-error">{generateError}</p>}
              </div>
            )}

            {/* Step 4: View Plan */}
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
                  <div className="p-8 text-center text-sm text-on-surface-variant">
                    <div className="mx-auto w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                    AI 正在生成计划...
                  </div>
                )}
              </div>
            )}

            {/* History */}
            {step === 'history' && (
              <div className="space-y-4 max-w-2xl">
                <button onClick={() => setStep('upload')} className="text-sm text-primary hover:underline">&larr; 返回</button>
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
                        <button onClick={(e) => { e.stopPropagation(); deletePlan(p.id); }}
                          className="float-right text-xs text-error hover:underline">删除</button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
