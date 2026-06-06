import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAiScheduleStore } from '../../stores/aiScheduleStore';
import type { EditableCourse, ProfileData } from '../../types';
import type { SchedulePlan } from '../../services/aiScheduleApi';
import { aiScheduleApi } from '../../services/aiScheduleApi';
import ScheduleEditor from '../ScheduleEditor';
import CommitmentForm from './CommitmentForm';
import type { Commitment } from './CommitmentForm';
import PlanTimeline from './PlanTimeline';
import ProfileCard from './ProfileCard';
import PlanHistoryList from './PlanHistoryList';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, Clock, Heart, Settings } from 'lucide-react';

const CUSTOM_PROMPT_KEY = 'ai_schedule_custom_prompt';
const STORED_COURSES_KEY = 'ai_schedule_courses';
const STORED_COMMITMENTS_KEY = 'ai_schedule_commitments';

const SEMESTER_START = new Date('2026-03-02T00:00:00');

function computeCurrentWeek(): number {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - SEMESTER_START.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

export default function PersonalCenterPage() {
  const generatedPlan = useAiScheduleStore((s) => s.generatedPlan);
  const generating = useAiScheduleStore((s) => s.generating);
  const generateError = useAiScheduleStore((s) => s.generateError);
  const generatePlan = useAiScheduleStore((s) => s.generatePlan);
  const clearGenerated = useAiScheduleStore((s) => s.clearGenerated);
  const fetchPlans = useAiScheduleStore((s) => s.fetchPlans);
  const deletePlan = useAiScheduleStore((s) => s.deletePlan);
  const plans = useAiScheduleStore((s) => s.plans);

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<'list' | 'detail'>('list');
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerPlan, setDrawerPlan] = useState<SchedulePlan['plan_data'] | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCurrentWeekCourses = () => courses.filter((c) => c.weeks.includes(currentWeek));

  useEffect(() => {
    if (courses.length > 0) {
      console.log('[PersonalCenter] saving to localStorage:', courses.length, 'courses');
      localStorage.setItem(STORED_COURSES_KEY, JSON.stringify(courses));
    }
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
        console.log('[PersonalCenter] API loaded:', json.data?.courses?.length || 0, 'courses');
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

  const getToday = () => new Date().toISOString().slice(0, 10);

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
    // Don't auto-save here — save is explicit via button. Sending current-week
    // courses to AI should not overwrite the full course list in DB.
    const currentWeekCourses = getCurrentWeekCourses();
    const formattedCommitments = commitments.map((c) => ({ name: c.name, date: c.date, start_time: c.start, end_time: c.end, priority: c.priority }));
    localStorage.setItem(CUSTOM_PROMPT_KEY, customPrompt);

    // Merge profile info into prompt so AI actually uses it
    const profileContext = [
      profile.grade && `年级：${profile.grade}`,
      profile.major && `专业：${profile.major}`,
      profile.college && `学院：${profile.college}`,
      profile.planNote && `当前规划：${profile.planNote}`,
    ].filter(Boolean).join('；');
    const combinedPrompt = [profileContext, customPrompt.trim()].filter(Boolean).join('；');

    await generatePlan({
      courses: currentWeekCourses.map((c) => ({ name: c.course_name, weekday: c.weekday, sections: c.sections, weeks: c.weeks, teacher: c.teacher || '', location: c.location || '' })),
      commitments: formattedCommitments,
      grade: profile.grade || undefined, major: profile.major || undefined,
      next_monday: getToday(), model: textModel,
      current_week: currentWeek,
      custom_prompt: combinedPrompt || undefined,
    });
    fetchPlans();
  };

  // ── Drawer ──

  const openHistoryDrawer = () => {
    fetchPlans();
    setDrawerView('list');
    setDrawerTitle('历史计划');
    setDrawerOpen(true);
  };

  const handleHistorySelect = async (id: number) => {
    setDrawerLoading(true);
    try {
      const data = await aiScheduleApi.getPlan(id);
      const planData = data.plan_data;
      setDrawerPlan(planData);
      if (planData?.weekly_plans?.[0]) {
        setDrawerTitle(`${planData.weekly_plans[0].week_start} 起 · ${planData.weekly_plans.length}周`);
      }
      setDrawerView('detail');
    } catch { /* silent */ }
    finally { setDrawerLoading(false); }
  };

  const handleDrawerBack = () => {
    setDrawerView('list');
    setDrawerTitle('历史计划');
    setDrawerPlan(null);
  };

  const handleDeletePlan = async (id: number) => {
    await deletePlan(id);
    // If deleted plan was being viewed, go back to list
    if (drawerView === 'detail') {
      handleDrawerBack();
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerPlan(null);
  };

  const navigate = useNavigate();
  const cwCourses = getCurrentWeekCourses();
  const hasCourses = courses.length > 0;
  const hasPlan = !!generatedPlan;

  // Check if today is heavy — show counsel link
  const todayWeekday = new Date().getDay() || 7;
  const todayCourses = courses.filter((c) => c.weeks.includes(currentWeek) && c.weekday === todayWeekday);
  const todaySectionCount = todayCourses.reduce((sum, c) => sum + c.sections.length, 0);
  const isHeavyDay = todaySectionCount >= 5 || commitments.length >= 3;

  const buildCounselContext = () => {
    const today = new Date().toLocaleDateString('zh-CN');
    const lines = [`今天是${today}，第${currentWeek}周。以下是我今天的课表和待办事项：`];
    if (todayCourses.length > 0) {
      lines.push('今日课程：');
      todayCourses.forEach((c) => {
        lines.push(`- ${c.course_name}（第${c.sections.join('-')}节${c.teacher ? `，${c.teacher}` : ''}${c.location ? `，${c.location}` : ''}）`);
      });
    }
    if (commitments.length > 0) {
      lines.push('待办事项：');
      commitments.forEach((c) => {
        const priority = c.priority === 'high' ? '高优先' : c.priority === 'medium' ? '中优先' : '低优先';
        lines.push(`- ${c.name}（${c.date || '未指定日期'} ${c.start}-${c.end}，${priority}）`);
      });
    }
    lines.push(`\n本周共${cwCourses.length}门课程，${commitments.length}个待办事项。`);
    lines.push('今天安排比较多，想和我聊聊怎么调整节奏、缓解压力吗？');
    return lines.join('\n');
  };

  const handleCounselLink = () => {
    localStorage.setItem('ai_counsel_pending_context', buildCounselContext());
    navigate('/ai-counsel');
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
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

      <div className="flex-1 flex min-h-0 relative">
        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin p-4 lg:p-6 space-y-4">
          <ProfileCard onChange={setProfile} />

          {/* Toolbar: tabs + actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-surface-container-low/50 rounded-xl p-1">
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

            {/* Actions — varies by tab */}
            <div className="flex items-center gap-2 flex-wrap">
              {activeTab === 'plan' && (
                <>
                  <button
                    onClick={openHistoryDrawer}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors text-xs text-on-surface-variant"
                  >
                    <Clock size={13} />
                    历史{plans.length > 0 && ` (${plans.length})`}
                  </button>
                  {hasCourses && (
                    <>
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
                        ) : hasPlan ? '✨ 重新生成' : '✨ 生成计划'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ===== AI Plan Tab ===== */}
          {activeTab === 'plan' && (
            <div className="space-y-4">
              {!hasCourses ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-3 opacity-30">📋</div>
                  <p className="text-sm font-medium text-on-surface mb-1">还没有课表</p>
                  <p className="text-xs text-on-surface-variant mb-4">在「个人课表」Tab 上传课表后开始使用</p>
                  <button onClick={() => setActiveTab('schedule')} className="btn-outline text-sm px-4 py-2">
                    去上传课表
                  </button>
                </div>
              ) : hasPlan ? (
                <>
                  <PlanTimeline plan={generatedPlan} />
                  {generateError && <div className="p-3 bg-error/10 text-error rounded-lg text-sm">{generateError}</div>}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-on-surface-variant mb-1">点击上方「✨ 生成计划」创建本周学习计划</p>
                </div>
              )}

              {isHeavyDay && hasCourses && (
                <button
                  onClick={handleCounselLink}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-secondary/5 border border-secondary/20 hover:bg-secondary/10 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 group-hover:bg-secondary/20 transition-colors">
                    <Heart size={18} className="text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface">今天安排比较满</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {todaySectionCount > 0 ? `${todaySectionCount}节课` : ''}
                      {todaySectionCount > 0 && commitments.length > 0 ? ' + ' : ''}
                      {commitments.length > 0 ? `${commitments.length}个待办` : ''}
                      ，和小暖聊聊调整节奏？
                    </p>
                  </div>
                  <span className="text-xs text-secondary font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">去聊聊 →</span>
                </button>
              )}
            </div>
          )}

          {/* ===== 个人课表 Tab ===== */}
          {activeTab === 'schedule' && (
            <>
            <div className="flex gap-4 min-h-0">
              {/* Schedule editor */}
              <div className="flex-1 min-w-0">
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
                  <>
                    <ScheduleEditor courses={courses} onCoursesChange={(newCourses) => { console.log('[PersonalCenter] ScheduleEditor changed courses:', newCourses.length); setCourses(newCourses); }}
                      onSave={handleSave} isSaving={saving}
                      onCancel={() => { setCourses([]); clearGenerated(); }} />

                    <button
                      onClick={() => setMobilePanelOpen(true)}
                      className="lg:hidden mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant/30 bg-surface-container-low/40 text-xs text-on-surface-variant hover:bg-surface-container-low transition-colors"
                    >
                      <Settings size={14} /> 更多设置
                    </button>

                    {isHeavyDay && (
                      <button
                        onClick={handleCounselLink}
                        className="w-full flex items-center gap-3 p-4 mt-4 rounded-2xl bg-secondary/5 border border-secondary/20 hover:bg-secondary/10 transition-colors text-left group"
                      >
                        <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 group-hover:bg-secondary/20 transition-colors">
                          <Heart size={18} className="text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface">今天安排比较满</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {todaySectionCount > 0 ? `${todaySectionCount}节课` : ''}
                            {todaySectionCount > 0 && commitments.length > 0 ? ' + ' : ''}
                            {commitments.length > 0 ? `${commitments.length}个待办` : ''}
                            ，和小暖聊聊调整节奏？
                          </p>
                        </div>
                        <span className="text-xs text-secondary font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">去聊聊 →</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Right panel — desktop: side panel; mobile: hidden (shown in drawer) */}
              <div className="hidden lg:block w-60 xl:w-72 shrink-0 space-y-3">
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
            </div>

            {/* Mobile settings drawer */}
            <AnimatePresence>
              {mobilePanelOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/20 z-30 lg:hidden"
                    onClick={() => setMobilePanelOpen(false)}
                  />
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="fixed right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-surface-container-lowest border-l border-outline-variant/30 z-40 flex flex-col shadow-2xl lg:hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 shrink-0">
                      <h3 className="text-sm font-semibold text-on-surface">更多设置</h3>
                      <button onClick={() => setMobilePanelOpen(false)} className="p-1 hover:bg-surface-container-low rounded-lg transition-colors shrink-0">
                        <X size={18} className="text-on-surface-variant" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
                      <div>
                        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">课表上传</h3>
                        <div
                          onClick={() => { fileInputRef.current?.click(); setMobilePanelOpen(false); }}
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
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            </>
          )}
        </div>

        {/* History drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/20 z-30"
                onClick={closeDrawer}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute right-0 top-0 bottom-0 w-[720px] max-w-[95vw] bg-surface-container-lowest border-l border-outline-variant/30 z-40 flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {drawerView === 'detail' && (
                      <button onClick={handleDrawerBack} className="p-1 hover:bg-surface-container-low rounded-lg transition-colors shrink-0">
                        <ChevronLeft size={18} className="text-on-surface-variant" />
                      </button>
                    )}
                    <h3 className="text-sm font-semibold text-on-surface truncate">{drawerTitle}</h3>
                  </div>
                  <button onClick={closeDrawer} className="p-1 hover:bg-surface-container-low rounded-lg transition-colors shrink-0">
                    <X size={18} className="text-on-surface-variant" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                  {drawerView === 'list' ? (
                    <PlanHistoryList onSelect={handleHistorySelect} onDelete={handleDeletePlan} />
                  ) : drawerLoading ? (
                    <div className="text-sm text-on-surface-variant text-center py-8">加载中...</div>
                  ) : drawerPlan ? (
                    <PlanTimeline plan={drawerPlan} compact />
                  ) : (
                    <div className="text-sm text-on-surface-variant text-center py-8">加载失败</div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
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
