# 个人中心页面实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 排课页面改造为个人中心页面 — 新增资料卡片和 AI 计划历史，保留原有 AI 排课功能。

**Architecture:** 在现有 AiSchedulePage 组件基础上重构为 PersonalCenterPage。Store 和 API 层已支持计划历史（`plans`/`fetchPlans`/`fetchPlanDetail`），无需后端改动。资料卡片用 localStorage 存储年级/专业/学院/规划字段。三组件拆分：PersonalCenterPage（主页面）+ ProfileCard（资料卡片）+ PlanHistoryList（历史列表）。

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind CSS, lucide-react, motion/react

---

### Task 1: 类型定义更新

**Files:**
- Modify: `src/types.ts:1-18`

- [ ] **Step 1: 更新 RoutePath 和 ROUTE_LABELS**

```typescript
// src/types.ts — 修改 RoutePath union 和 ROUTE_LABELS

// RoutePath: 第 2 行，加 '| /profile'
export type RoutePath = '/dashboard' | '/files' | '/courses' | '/contacts' | '/schedule' | '/chat' | '/scoring' | '/login' | '/users' | '/file-center' | '/psychology' | '/ai-schedule' | '/ai-counsel' | '/profile';

// ROUTE_LABELS: 第 14-15 行之间，加一行
  '/ai-schedule': 'AI 排课',
  '/ai-counsel': 'AI 咨询',
  '/profile': '个人中心',
```

- [ ] **Step 2: 在 types.ts 末尾新增 ProfileData 类型**

```typescript
// 在文件末尾追加
export interface ProfileData {
  grade: string;
  major: string;
  college: string;
  planNote: string;
}
```

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 2: 导航更新

**Files:**
- Modify: `src/components/Layout.tsx:29-37, 73-87`

- [ ] **Step 1: 修改 navItems 数组**

找到第 36 行 `{ id: 'ai-schedule', label: 'AI 排课', icon: 'bot' }`，替换为：

```typescript
{ id: 'profile', label: '个人中心', icon: 'user' },
```

- [ ] **Step 2: 在 getIcon 函数添加 'user' case**

在第 85 行 `default` 前添加：

```typescript
case 'user': return <User size={20} />;
```

- [ ] **Step 3: 在 lucide-react import 添加 User**

第 4-22 行 import 区域，添加 `User`：

```typescript
import {
  LayoutDashboard,
  BookOpen,
  FolderOpen,
  Users,
  CalendarDays,
  MessageSquare,
  Plus,
  Settings,
  HelpCircle,
  Search,
  Bell,
  Menu,
  X,
  Trophy,
  Heart,
  Bot,
  Smile,
  LogOut,
  Shield,
  User,  // 新增
} from 'lucide-react';
```

- [ ] **Step 4: 同时修改移动端底部导航按钮 id**

第 269 行的 `visibleNavItems.map` 已经由 navItems 驱动，无需额外修改。

- [ ] **Step 5: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 3: 路由更新

**Files:**
- Modify: `src/App.tsx:20-21, 63-64`

- [ ] **Step 1: 添加 PersonalCenterPage 懒加载 import**

在第 21 行后添加：

```typescript
const PersonalCenterPage = lazy(() => import('./components/ai-schedule/PersonalCenterPage'));
```

- [ ] **Step 2: 添加 /profile 路由，保留 /ai-schedule 为旧路由重定向**

把第 63 行：
```typescript
<Route path="/ai-schedule" element={<AiSchedulePage />} />
```
改为：
```typescript
<Route path="/profile" element={<PersonalCenterPage />} />
<Route path="/ai-schedule" element={<Navigate to="/profile" replace />} />
```

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 4: ProfileCard 组件

**Files:**
- Create: `src/components/ai-schedule/ProfileCard.tsx`

- [ ] **Step 1: 创建 ProfileCard.tsx**

```typescript
import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import type { ProfileData } from '../../types';

const PROFILE_KEY = 'user_profile';

function loadProfile(): ProfileData {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { grade: '', major: '', college: '', planNote: '' };
}

interface ProfileCardProps {
  onChange?: (profile: ProfileData) => void;
}

export default function ProfileCard({ onChange }: ProfileCardProps) {
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(loadProfile);
  const [draft, setDraft] = useState<ProfileData>(profile);

  const roleLabel = user?.role === 'admin' ? '管理员' : user?.role === 'teacher' ? '教师' : '学生';

  const handleEdit = () => {
    setDraft({ ...profile });
    setEditing(true);
  };

  const handleSave = () => {
    setProfile(draft);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(draft));
    onChange?.(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-surface-container-low/60 rounded-2xl border border-outline-variant/30 p-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
            {user?.name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                value={draft.grade}
                onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
                placeholder="年级 (如 2024级)"
                className="px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring w-36"
              />
              <input
                value={draft.major}
                onChange={(e) => setDraft({ ...draft, major: e.target.value })}
                placeholder="专业 (如 计算机科学)"
                className="px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring w-36"
              />
              <input
                value={draft.college}
                onChange={(e) => setDraft({ ...draft, college: e.target.value })}
                placeholder="学院 (如 信息学院)"
                className="px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring w-36"
              />
            </div>
            <textarea
              value={draft.planNote}
              onChange={(e) => setDraft({ ...draft, planNote: e.target.value })}
              placeholder="当前规划 (如：本学期重点准备考研，晚上效率高)"
              rows={2}
              className="w-full px-2.5 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus-ring resize-none"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleSave} className="btn-outline text-sm px-3 py-1.5">保存</button>
            <button onClick={handleCancel} className="text-sm px-3 py-1.5 text-on-surface-variant hover:text-on-surface">取消</button>
          </div>
        </div>
      </div>
    );
  }

  const hasProfile = profile.grade || profile.major || profile.college || profile.planNote;

  return (
    <div className="bg-surface-container-low/60 rounded-2xl border border-outline-variant/30 p-4">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
          {user?.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-on-surface">{user?.name || '未设置'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{roleLabel}</span>
            {user?.department && (
              <span className="text-xs text-on-surface-variant">{user.department}</span>
            )}
          </div>
          {hasProfile ? (
            <div className="text-sm text-on-surface-variant mt-1">
              {[profile.grade, profile.major, profile.college].filter(Boolean).join(' · ')}
              {profile.planNote && (
                <p className="mt-1 text-xs text-on-surface-variant/70 line-clamp-1">{profile.planNote}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant/50 mt-1">点击编辑补充个人信息，帮助 AI 更好地生成计划</p>
          )}
        </div>
        <button onClick={handleEdit} className="text-xs text-primary hover:underline shrink-0">编辑</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 5: PlanHistoryList 组件

**Files:**
- Create: `src/components/ai-schedule/PlanHistoryList.tsx`

- [ ] **Step 1: 创建 PlanHistoryList.tsx**

```typescript
import { useAiScheduleStore } from '../../stores/aiScheduleStore';
import PlanTimeline from './PlanTimeline';

export default function PlanHistoryList() {
  const plans = useAiScheduleStore((s) => s.plans);
  const plansLoading = useAiScheduleStore((s) => s.plansLoading);
  const selectedPlan = useAiScheduleStore((s) => s.selectedPlan);
  const fetchPlanDetail = useAiScheduleStore((s) => s.fetchPlanDetail);
  const generatedPlan = useAiScheduleStore((s) => s.generatedPlan);

  // 查看历史计划详情：如果 selectedPlan 有值则展示
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
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 6: PersonalCenterPage 主页面

**Files:**
- Create: `src/components/ai-schedule/PersonalCenterPage.tsx`

- [ ] **Step 1: 创建 PersonalCenterPage.tsx**

```typescript
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

export default function PersonalCenterPage() {
  const user = useAuthStore((s) => s.user);
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

    await generatePlan({
      courses: currentWeekCourses.map((c) => ({ name: c.course_name, weekday: c.weekday, sections: c.sections, weeks: c.weeks, teacher: c.teacher || '', location: c.location || '' })),
      commitments: formattedCommitments,
      grade: profile.grade || undefined, major: profile.major || undefined,
      next_monday: getNextMonday(), model: textModel,
      current_week: currentWeek,
      custom_prompt: customPrompt.trim() || undefined,
    });
    fetchPlans(); // refresh history after generation
  };

  const handleProfileChange = (p: ProfileData) => {
    setProfile(p);
  };

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

  const cwCourses = getCurrentWeekCourses();
  const hasCourses = courses.length > 0;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
      <style>{` .scrollbar-thin::-webkit-scrollbar { width: 4px; } .scrollbar-thin::-webkit-scrollbar-track { background: transparent; } .scrollbar-thin::-webkit-scrollbar-thumb { background: rgb(var(--outline-variant)/.3); border-radius: 2px; } `}</style>

      {/* TopBar */}
      <div className="sticky top-0 z-20 bg-surface-container-lowest/95 backdrop-blur-sm border-b border-outline-variant/30 px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold font-headline title-ink">个人中心</h2>
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
            {hasCourses && <button onClick={handleSave} disabled={saving} className="btn-outline text-sm px-3 py-1.5">{saving ? '保存中' : '保存'}</button>}
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Main content area */}
        <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin p-4 lg:p-6 space-y-4">
          {/* Profile Card */}
          <ProfileCard onChange={handleProfileChange} />

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

          {/* Tab content */}
          {activeTab === 'plan' ? (
            <div className="space-y-4">
              {/* Generate section */}
              {hasCourses ? (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">生成新计划</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">基于当前周课表 + 待办 + 个人资料</p>
                  </div>
                  <button onClick={handleGenerate} disabled={generating}
                    className="btn-primary text-sm px-5 py-2 font-semibold shadow-sm whitespace-nowrap">
                    {generating ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                        AI 分析中...
                      </span>
                    ) : '✨ 生成'}
                  </button>
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

              {/* Generated plan result */}
              {generatedPlan && (
                <div className="space-y-3">
                  <PlanTimeline plan={generatedPlan} />
                  {generateError && <div className="p-3 bg-error/10 text-error rounded-lg text-sm">{generateError}</div>}
                </div>
              )}

              {/* Plan history */}
              <PlanHistoryList />
            </div>
          ) : (
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
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

---

### Task 7: 验证

- [ ] **Step 1: 启动 dev server 验证**

```bash
npm run dev
```

- [ ] **Step 2: 跑布局健康检查**

```bash
npx playwright test tests/layout-health.spec.ts
```

- [ ] **Step 3: 跑全量 E2E 测试**

```bash
npx playwright test
```

- [ ] **Step 4: 手动验证清单**
  - [ ] 导航栏显示"个人中心"（User 图标）
  - [ ] 点击进入，页面显示资料卡片（未编辑时显示引导文案）
  - [ ] 点击编辑 → 修改年级/专业/学院/规划 → 保存 → 刷新后数据保持
  - [ ] Tab 切换到"个人课表" → 上传课表 → ScheduleEditor 正常
  - [ ] Tab 切回"AI 计划" → 点击生成 → PlanTimeline 展示结果
  - [ ] 历史计划列表出现新生成的计划
  - [ ] 点击历史计划卡片 → 展开查看完整内容
  - [ ] 旧路由 `/ai-schedule` 重定向到 `/profile`
  - [ ] 移动端底部导航正常显示"个人中心"

- [ ] **Step 5: 提交**

```bash
git add src/types.ts src/components/Layout.tsx src/App.tsx src/components/ai-schedule/ProfileCard.tsx src/components/ai-schedule/PlanHistoryList.tsx src/components/ai-schedule/PersonalCenterPage.tsx
git commit -m "feat: AI排课页面改造为个人中心，新增资料卡片和计划历史"
```

---

## 改动文件总览

| 文件 | 操作 | 改动量 |
|------|------|--------|
| `src/types.ts` | 修改 | +5 行 |
| `src/components/Layout.tsx` | 修改 | ~3 处 |
| `src/App.tsx` | 修改 | +3 行 |
| `src/components/ai-schedule/ProfileCard.tsx` | **新建** | ~95 行 |
| `src/components/ai-schedule/PlanHistoryList.tsx` | **新建** | ~65 行 |
| `src/components/ai-schedule/PersonalCenterPage.tsx` | **新建** | ~250 行 |
| `src/components/ai-schedule/AiSchedulePage.tsx` | 不变 | 0 |

**无需改动：** aiScheduleStore、aiScheduleApi、ScheduleEditor、CommitmentForm、PlanTimeline、后端 API、数据库。
