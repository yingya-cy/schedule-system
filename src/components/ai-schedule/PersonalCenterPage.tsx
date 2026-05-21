import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAiScheduleStore } from '../../stores/aiScheduleStore';
import type { EditableCourse, ProfileData } from '../../types';
import ScheduleEditor from '../ScheduleEditor';
import CommitmentForm from './CommitmentForm';
import type { Commitment } from './CommitmentForm';
import PlanTimeline from './PlanTimeline';
import ProfileCard from './ProfileCard';
import PlanHistoryList from './PlanHistoryList';

const CUSTOM_PROMPT_KEY = 'ai_schedule_custom_prompt';
const STORED_COURSES_KEY = 'ai_schedule_courses';
const STORED_COMMITMENTS_KEY = 'ai_schedule_commitments';

const SEMESTER_START = new Date('2026-03-02T00:00:00');

function computeCurrentWeek(): number {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - SEMESTER_START.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日'];

export default function PersonalCenterPage() {
  const generatedPlan = useAiScheduleStore((s) => s.generatedPlan);
  const generating = useAiScheduleStore((s) => s.generating);
  const generateError = useAiScheduleStore((s) => s.generateError);
  const generatePlan = useAiScheduleStore((s) => s.generatePlan);
  const clearGenerated = useAiScheduleStore((s) => s.clearGenerated);
  const fetchPlans = useAiScheduleStore((s) => s.fetchPlans);

  const [courses, setCourses] = useState<EditableCourse[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [textModel, setTextModel] = useState(() => localStorage.getItem('ai_text_model') || 'deepseek-v4-pro');
  const [customPrompt, setCustomPrompt] = useState(() => localStorage.getItem(CUSTOM_PROMPT_KEY) || '');
  const [profile, setProfile] = useState<ProfileData>(() => {
    try {
      const raw = localStorage.getItem('user_profile');
      return raw ? JSON.parse(raw) : { grade: '', major: '', college: '', planNote: '' };
    } catch { return { grade: '', major: '', college: '', planNote: '' }; }
  });
  const [currentWeek] = useState<number>(computeCurrentWeek);
  const [activeTab, setActiveTab] = useState<'plan' | 'schedule'>('plan');
  const [planExpanded, setPlanExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCurrentWeekCourses = () => courses.filter((c) => c.weeks.includes(currentWeek));

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
        try {
          const saved = localStorage.getItem(STORED_COURSES_KEY);
          if (saved) setCourses(JSON.parse(saved));
        } catch { /* no saved courses */ }
      }
      finally { setInitialLoading(false); }
    })();
    fetchPlans();
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

    setPlanExpanded(true);
    await generatePlan({
      courses: currentWeekCourses.map((c) => ({ name: c.course_name, weekday: c.weekday, sections: c.sections, weeks: c.weeks, teacher: c.teacher || '', location: c.location || '' })),
      commitments: formattedCommitments,
      grade: profile.grade || undefined, major: profile.major || undefined,
      next_monday: getNextMonday(), model: textModel,
      current_week: currentWeek,
      custom_prompt: customPrompt.trim() || undefined,
    });
    fetchPlans();
  };

  // Compact weekly schedule overview
  const cwCourses = getCurrentWeekCourses();
  const hasCourses = courses.length > 0;
  const coursesByDay: Record<number, EditableCourse[]> = {};
  cwCourses.forEach((c) => {
    if (!coursesByDay[c.weekday]) coursesByDay[c.weekday] = [];
    coursesByDay[c.weekday].push(c);
  });

  if (initialLoading) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
      <style>{` .scrollbar-thin::-webkit-scrollbar { width: 4px; } .scrollbar-thin::-webkit-scrollbar-track { background: transparent; } .scrollbar-thin::-webkit-scrollbar-thumb { background: rgb(var(--outline-variant)/.3); border-radius: 2px; } `}</style>

      {/* TopBar — title only, clean */}
      <div className="sticky top-0 z-20 bg-surface-container-lowest/95 backdrop-blur-sm border-b border-outline-variant/30 px-4 lg:px-6 py-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold font-headline title-ink">个人中心</h2>
          {hasCourses && (
            <span className="text-[11px] text-on-surface-variant">
              第{currentWeek}周 · {cwCourses.length}/{courses.length}门课
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Main content — full width on plan tab, shared on schedule tab */}
        <div className={`flex-1 min-w-0 overflow-y-auto scrollbar-thin p-4 lg:p-6 space-y-4 ${activeTab === 'schedule' ? '' : ''}`}>
          <ProfileCard onChange={setProfile} />

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-surface-container-low/50 rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'plan' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              AI 计划
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'schedule' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              个人课表
            </button>
          </div>

          {/* ===== AI Plan Tab ===== */}
          {activeTab === 'plan' && (
            <div className="space-y-4">
              {/* Weekly schedule at a glance */}
              {hasCourses && (
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 p-4">
                  <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-3">
                    第{currentWeek}周课程
                  </h3>
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_SHORT.map((day, i) => {
                      const dayCourses = coursesByDay[i + 1] || [];
                      return (
                        <div key={i} className="text-center">
                          <div className="text-[10px] text-outline mb-1">{day}</div>
                          <div className="space-y-0.5">
                            {dayCourses.slice(0, 3).map((c) => (
                              <div
                                key={c.id}
                                className="text-[9px] leading-tight px-0.5 py-0.5 rounded bg-primary/10 text-primary truncate"
                                title={c.course_name}
                              >
                                {c.course_name.length > 4 ? c.course_name.slice(0, 4) + '…' : c.course_name}
                              </div>
                            ))}
                            {dayCourses.length > 3 && (
                              <div className="text-[9px] text-outline">+{dayCourses.length - 3}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Generate section — with model + save next to generate */}
              {hasCourses ? (
                <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
                  <p className="text-sm font-semibold text-on-surface mb-1">生成新计划</p>
                  <p className="text-xs text-on-surface-variant mb-3">基于当前周课表 + 待办 + 个人资料</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={textModel}
                      onChange={(e) => { setTextModel(e.target.value); localStorage.setItem('ai_text_model', e.target.value); }}
                      className="px-2 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-[11px] focus-ring">
                      <option value="deepseek-v4-pro">DeepSeek</option>
                      <option value="minimax-m2.7">MiniMax</option>
                    </select>
                    <button onClick={handleSave} disabled={saving} className="btn-outline text-sm px-3 py-1.5">
                      {saving ? '保存中' : '保存'}
                    </button>
                    <button onClick={handleGenerate} disabled={generating}
                      className="btn-primary text-sm px-5 py-2 font-semibold shadow-sm">
                      {generating ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                          AI 分析中...
                        </span>
                      ) : '✨ 生成'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-3xl mb-3 opacity-30">📋</div>
                  <p className="text-sm font-medium text-on-surface mb-1">还没有课表</p>
                  <p className="text-xs text-on-surface-variant mb-4">在「个人课表」Tab 上传课表后开始使用</p>
                  <button onClick={() => setActiveTab('schedule')} className="btn-outline text-sm px-4 py-2">
                    去上传课表
                  </button>
                </div>
              )}

              {/* Generated plan — collapsible card */}
              {generatedPlan && (
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 overflow-hidden">
                  <button
                    onClick={() => setPlanExpanded(!planExpanded)}
                    className="w-full text-left p-4 flex items-center justify-between hover:bg-surface-container-low/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{planExpanded ? '▼' : '▶'}</span>
                      <span className="text-sm font-semibold text-on-surface">
                        {generatedPlan.weekly_plans?.[0]?.week_start || ''} 起 · {generatedPlan.weekly_plans?.length || 0}周计划
                      </span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant">
                      {new Date().toLocaleDateString('zh-CN')}
                    </span>
                  </button>
                  {planExpanded && (
                    <div className="px-4 pb-4">
                      <PlanTimeline plan={generatedPlan} />
                      {generateError && <div className="mt-2 p-3 bg-error/10 text-error rounded-lg text-sm">{generateError}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* Plan history */}
              <PlanHistoryList />
            </div>
          )}

          {/* ===== 个人课表 Tab ===== */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              {!hasCourses ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-3 opacity-30">📋</div>
                  <p className="text-sm font-medium text-on-surface mb-1">还没有课表</p>
                  <p className="text-xs text-on-surface-variant mb-4">上传课表图片或 PDF 开始使用</p>
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
              ) : (
                <ScheduleEditor courses={courses} onCoursesChange={setCourses}
                  onCancel={() => { setCourses([]); clearGenerated(); }} />
              )}
            </div>
          )}
        </div>

        {/* Right panel — only visible on 个人课表 tab */}
        {activeTab === 'schedule' && (
          <div className="w-60 xl:w-72 shrink-0 border-l border-outline-variant/30 overflow-y-auto scrollbar-thin p-3 space-y-3 bg-surface-container-lowest/50">
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

            <div>
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">待办事项</h3>
              <CommitmentForm items={commitments} onChange={setCommitments} />
            </div>

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
        )}
      </div>

      {generateError && activeTab !== 'plan' && (
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
