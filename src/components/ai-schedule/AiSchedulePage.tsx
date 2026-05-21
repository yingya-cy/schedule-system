import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAiScheduleStore } from '../../stores/aiScheduleStore';
import type { EditableCourse } from '../../types';
import ScheduleEditor from '../ScheduleEditor';
import CommitmentForm from './CommitmentForm';
import type { Commitment } from './CommitmentForm';
import PlanTimeline from './PlanTimeline';

const CUSTOM_PROMPT_KEY = 'ai_schedule_custom_prompt';
const STORED_COURSES_KEY = 'ai_schedule_courses';
const STORED_COMMITMENTS_KEY = 'ai_schedule_commitments';

// 学期起始：2026-03-02（周一），5月20日为第12周
const SEMESTER_START = new Date('2026-03-02T00:00:00');

function computeCurrentWeek(): number {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - SEMESTER_START.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

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
  const [textModel, setTextModel] = useState(() => localStorage.getItem('ai_text_model') || 'deepseek-v4-pro');
  const [customPrompt, setCustomPrompt] = useState(() => localStorage.getItem(CUSTOM_PROMPT_KEY) || '');
  const [grade, setGrade] = useState('');
  const [major, setMajor] = useState('');
  const [currentWeek, setCurrentWeek] = useState<number>(computeCurrentWeek);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCurrentWeekCourses = () => courses.filter((c) => c.weeks.includes(currentWeek));

  // Persist courses/commitments to localStorage so they survive refresh
  useEffect(() => {
    if (courses.length > 0) localStorage.setItem(STORED_COURSES_KEY, JSON.stringify(courses));
  }, [courses]);
  useEffect(() => {
    if (commitments.length > 0) localStorage.setItem(STORED_COMMITMENTS_KEY, JSON.stringify(commitments));
  }, [commitments]);

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
          if (json.data.plan) useAiScheduleStore.setState({ generatedPlan: json.data.plan });
          if (json.data.planId) setPlanId(json.data.planId);
        }
      } catch {
        // Fallback to localStorage
        try {
          const saved = localStorage.getItem(STORED_COURSES_KEY);
          if (saved) setCourses(JSON.parse(saved));
        } catch { /* no saved courses */ }
      }
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
      const res = await fetch('/api/ai/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '识别失败');
      const recognized = data.data.courses || [];
      if (recognized.length === 0) { setUploadError('未能识别到课程'); return; }
      setCourses(recognized);
      clearGenerated();
      setPlanId(null);
    } catch (err: unknown) { setUploadError(err instanceof Error ? err.message : '上传失败'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (courses.length === 0) return;
    setSaving(true);
    try {
      const token = useAuthStore.getState().token;
      const res = await fetch('/api/ai/save-schedule', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses, commitments }),
      });
      const data = await res.json();
      if (data.success) setPlanId(data.data.id);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    if (courses.length === 0) return;
    await handleSave();
    const currentWeekCourses = getCurrentWeekCourses();
    const formattedCommitments = commitments.map((c) => ({ name: c.name, date: c.date, start_time: c.start, end_time: c.end, priority: c.priority }));
    localStorage.setItem(CUSTOM_PROMPT_KEY, customPrompt);
    localStorage.setItem('ai_schedule_grade', grade);
    localStorage.setItem('ai_schedule_major', major);

    await generatePlan({
      courses: currentWeekCourses.map((c) => ({ name: c.course_name, weekday: c.weekday, sections: c.sections, weeks: c.weeks, teacher: c.teacher || '', location: c.location || '' })),
      commitments: formattedCommitments,
      grade: grade || undefined, major: major || undefined,
      next_monday: getNextMonday(), model: textModel,
      current_week: currentWeek,
      custom_prompt: customPrompt.trim() || undefined,
    });
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton-card" />
        </div>
      </div>
    );
  }

  const cwCourses = getCurrentWeekCourses();
  const hasCourses = courses.length > 0;

  const TopBar = ({ planMode }: { planMode: boolean }) => (
    <div className="sticky top-0 z-20 bg-surface-container-lowest/95 backdrop-blur-sm border-b border-outline-variant/30 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-on-surface font-headline">{planMode ? '学习计划' : 'AI 日程安排'}</h2>
          {hasCourses && (
            <span className="text-[11px] text-on-surface-variant">
              第{currentWeek}周 · {cwCourses.length}/{courses.length}门课
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={textModel}
            onChange={(e) => { setTextModel(e.target.value); localStorage.setItem('ai_text_model', e.target.value); }}
            className="px-2 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-[11px] focus-ring">
            <option value="deepseek-v4-pro">DeepSeek</option>
            <option value="minimax-m2.7">MiniMax</option>
          </select>
          {planMode ? (
            <>
              <button onClick={handleGenerate} disabled={generating || saving}
                className="btn-outline text-sm px-3 py-1.5">
                {generating ? '生成中...' : '重新生成'}
              </button>
              <button onClick={() => { clearGenerated(); }} className="btn-outline text-sm px-3 py-1.5">编辑课表</button>
              <button onClick={handleSave} disabled={saving} className="btn-outline text-sm px-3 py-1.5">{saving ? '保存中' : '保存'}</button>
            </>
          ) : (
            <>
              {hasCourses && <button onClick={handleSave} disabled={saving} className="btn-outline text-sm px-3 py-1.5">{saving ? '保存中' : '保存'}</button>}
              {hasCourses && (
                <button onClick={handleGenerate} disabled={generating}
                  className="btn-primary text-sm px-5 py-2 font-semibold shadow-sm">
                  {generating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                      AI 分析中...
                    </span>
                  ) : '✨ 生成学习计划'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ===== PHASE 2: Plan is hero =====
  if (generatedPlan) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
        <style>{` .scrollbar-thin::-webkit-scrollbar { width: 4px; } .scrollbar-thin::-webkit-scrollbar-track { background: transparent; } .scrollbar-thin::-webkit-scrollbar-thumb { background: rgb(var(--outline-variant)/.3); border-radius: 2px; } `}</style>
        <TopBar planMode />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 lg:p-6 space-y-5">
          <PlanTimeline plan={generatedPlan} />
          {generateError && <div className="p-3 bg-error/10 text-error rounded-lg text-sm">{generateError}</div>}
          <details className="bg-surface-container-low/40 rounded-xl border border-outline-variant/20">
            <summary className="px-4 py-2.5 cursor-pointer text-sm font-medium text-on-surface select-none">
              {currentWeek ? `第${currentWeek}周 · ` : ''}{cwCourses.length}门课 · {commitments.length}个事项 · 点击展开课表
            </summary>
            <div className="px-4 pb-4 space-y-4">
              <ScheduleEditor courses={courses} onCoursesChange={setCourses} onCancel={() => { setCourses([]); clearGenerated(); }} />
              {commitments.length > 0 && (
                <details className="bg-surface-container-low rounded-xl border border-outline-variant/30 p-3">
                  <summary className="cursor-pointer text-sm font-medium">待办事项 ({commitments.length})</summary>
                  <div className="mt-2"><CommitmentForm items={commitments} onChange={setCommitments} /></div>
                </details>
              )}
            </div>
          </details>
        </div>
      </div>
    );
  }

  // ===== PHASE 1: Setup =====
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
      <style>{` .scrollbar-thin::-webkit-scrollbar { width: 4px; } .scrollbar-thin::-webkit-scrollbar-track { background: transparent; } .scrollbar-thin::-webkit-scrollbar-thumb { background: rgb(var(--outline-variant)/.3); border-radius: 2px; } `}</style>
      <TopBar planMode={false} />

      {!hasCourses ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-4xl mb-4 opacity-30">📋</div>
            <p className="text-lg font-semibold text-on-surface mb-1">还没有课表</p>
            <p className="text-sm text-on-surface-variant mb-6">上传课表图片或 PDF 开始使用 AI 日程安排</p>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`mx-auto inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${uploading ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary hover:bg-primary/5'}`}
            >
              {uploading ? (
                <><span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /><span className="text-sm text-on-surface-variant">识别中...</span></>
              ) : (
                <><span className="text-primary text-lg">+</span><span className="text-sm text-on-surface-variant">选择课表图片</span></>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
            {uploadError && <div className="mt-3 p-2 bg-error/10 text-error rounded-lg text-sm">{uploadError}</div>}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Left: ScheduleEditor */}
          <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin p-3 lg:p-4">
            <ScheduleEditor courses={courses} onCoursesChange={setCourses}
              onCancel={() => { setCourses([]); clearGenerated(); }} />
          </div>

          {/* Right panel */}
          <div className="w-60 xl:w-72 shrink-0 border-l border-outline-variant/30 overflow-y-auto scrollbar-thin p-3 space-y-3 bg-surface-container-lowest/50">
            {/* Upload */}
            <div>
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">课表上传</h3>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors text-xs ${uploading ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary hover:bg-primary/5'}`}
              >
                {uploading ? '识别中...' : courses.length > 0 ? '重新上传课表' : '选择课表图片或 PDF'}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
              {uploadError && <div className="mt-2 p-2 bg-error/10 text-error rounded text-xs">{uploadError}</div>}
            </div>

            {/* Commitments */}
            <div>
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">待办事项</h3>
              <CommitmentForm items={commitments} onChange={setCommitments} />
            </div>

            {/* Profile */}
            <div className="flex gap-2">
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">年级</h3>
                <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)}
                  placeholder="如：2024级"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-xs focus-ring" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">专业</h3>
                <input type="text" value={major} onChange={(e) => setMajor(e.target.value)}
                  placeholder="如：计算机科学"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-xs focus-ring" />
              </div>
            </div>

            {/* Custom prompt */}
            <div>
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">自定义偏好</h3>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="如：我是夜猫子，晚上效率高"
                rows={2}
                className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-xs focus-ring resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {generateError && (
        <div className="px-4 pb-3">
          <div className="p-3 bg-error/10 text-error rounded-lg text-sm flex items-center justify-between">
            <span>{generateError}</span>
            <button onClick={() => useAiScheduleStore.setState({ generateError: null })} className="font-bold">&times;</button>
          </div>
        </div>
      )}
    </div>
  );
}
