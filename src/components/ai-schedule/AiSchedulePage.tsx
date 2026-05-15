import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAiScheduleStore } from '../../stores/aiScheduleStore';
import type { EditableCourse } from '../../types';
import ScheduleEditor from '../ScheduleEditor';
import CommitmentForm from './CommitmentForm';
import type { Commitment } from './CommitmentForm';
import PlanTimeline from './PlanTimeline';

export default function AiSchedulePage() {
  const user = useAuthStore((s) => s.user);
  const generatedPlan = useAiScheduleStore((s) => s.generatedPlan);
  const generating = useAiScheduleStore((s) => s.generating);
  const generateError = useAiScheduleStore((s) => s.generateError);
  const generatePlan = useAiScheduleStore((s) => s.generatePlan);
  const clearGenerated = useAiScheduleStore((s) => s.clearGenerated);

  const [courses, setCourses] = useState<EditableCourse[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const token = useAuthStore.getState().token;
        const res = await fetch('/api/ai/latest-schedule', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.courses?.length > 0) setCourses(json.data.courses);
          if (json.data.commitments?.length > 0) {
            setCommitments(json.data.commitments.map((c: Record<string, string>) => ({
              name: c.name || '',
              date: c.date || '',
              start: c.start_time || c.start || '14:00',
              end: c.end_time || c.end || '16:00',
              priority: (c.priority || 'medium') as 'high' | 'medium' | 'low',
            })));
          }
          if (json.data.plan) {
            useAiScheduleStore.setState({ generatedPlan: json.data.plan });
          }
          if (json.data.planId) setPlanId(json.data.planId);
        }
      } catch { /* no saved state */ }
      finally { setInitialLoading(false); }
    })();
  }, []);

  const getNextMonday = () => {
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    return d.toISOString().slice(0, 10);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      clearGenerated();
      setPlanId(null);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (courses.length === 0) return;
    setSaving(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/ai/save-schedule', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses, commitments }),
      });
      const data = await res.json();
      if (data.success) setPlanId(data.data.id);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    if (courses.length === 0) return;

    // Save schedule first
    await handleSaveSchedule();

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
  };

  const hasData = courses.length > 0 || generatedPlan;

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
      <style>{`
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgb(var(--outline-variant)/.3); border-radius: 2px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgb(var(--outline)/.4); }
      `}</style>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface font-headline">AI 日程安排</h2>
          <div className="flex gap-2">
            {courses.length > 0 && (
              <button onClick={handleSaveSchedule} disabled={saving}
                className="btn-outline text-sm px-3 py-1.5">
                {saving ? '保存中...' : '保存'}
              </button>
            )}
            {courses.length > 0 && (
              <button onClick={handleGenerate} disabled={generating}
                className="btn-primary text-sm px-4 py-1.5">
                {generating ? 'AI 分析中...' : generatedPlan ? '重新生成计划' : '生成学习计划'}
              </button>
            )}
          </div>
        </div>

        {/* Upload */}
        <section>
          <h3 className="text-sm font-semibold text-on-surface-variant mb-3 uppercase tracking-wide">课表上传</h3>
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${uploading ? 'border-primary bg-primary/5 pointer-events-none' : 'border-outline-variant hover:border-primary hover:bg-primary/5'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-on-surface-variant">正在识别课表...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
                <span className="text-primary text-lg">+</span>
                {courses.length > 0 ? '重新上传课表（将覆盖当前课表）' : '上传课表图片或 PDF'}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
          </div>
          {uploadError && (
            <div className="mt-2 p-2 bg-error/10 text-error rounded-lg text-sm flex items-center justify-between">
              <span>{uploadError}</span>
              <button onClick={() => setUploadError('')} className="font-bold">&times;</button>
            </div>
          )}
        </section>

        {/* Schedule Editor */}
        {courses.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-on-surface-variant mb-3 uppercase tracking-wide">
              课表预览 ({courses.length} 门课程)
            </h3>
            <ScheduleEditor
              courses={courses}
              onCoursesChange={setCourses}
              onCancel={() => { setCourses([]); clearGenerated(); }}
            />
          </section>
        )}

        {/* Commitments */}
        {courses.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-on-surface-variant mb-3 uppercase tracking-wide">待办事项</h3>
            <div className="max-w-2xl">
              <CommitmentForm items={commitments} onChange={setCommitments} />
            </div>
          </section>
        )}

        {/* Plan */}
        {generatedPlan && (
          <section>
            <h3 className="text-sm font-semibold text-on-surface-variant mb-3 uppercase tracking-wide">学习计划</h3>
            <PlanTimeline plan={generatedPlan} />
          </section>
        )}

        {generateError && (
          <div className="p-3 bg-error/10 text-error rounded-lg text-sm">{generateError}</div>
        )}

        {!hasData && (
          <div className="text-center py-16 text-sm text-on-surface-variant">
            <p className="text-lg mb-1">还没有课表</p>
            <p>上传课表图片或 PDF 开始使用 AI 日程安排</p>
          </div>
        )}
      </div>
    </div>
  );
}
