import React, { useState, useEffect, useMemo, useRef } from 'react';
import HandbookPageHeading from '../HandbookPageHeading';
import { RefreshCw, Calendar, CalendarDays, Users, Clock, BookOpen, FolderOpen, Layers, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FreeTimeResult, TIME_SLOTS, WEEKDAYS } from '@/types';
import { api } from '@/services/api';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import ActivityEntries from '@/components/ActivityEntries';
import WeekSelector from '@/components/WeekSelector';
import DaySelector from '@/components/DaySelector';
import TimeSlotSelector from '@/components/TimeSlotSelector';
import FreeTimeGrid from '@/components/FreeTimeGrid';
import WeeklyFreeTimeOverview from '@/components/WeeklyFreeTimeOverview';
import { peopleForSections, sectionLabel } from '@/lib/freeTime';

interface DashboardStats {
  schedules: number;
  courses: number;
  users: number;
  departments: number;
  files: number;
}

export default function DashboardView() {
  const departments = useAppStore((s) => s.departments);
  const token = useAuthStore((s) => s.token);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedTimeSlotIndex, setSelectedTimeSlotIndex] = useState(0);
  const [freeTimeData, setFreeTimeData] = useState<FreeTimeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customStartSection, setCustomStartSection] = useState(1);
  const [customEndSection, setCustomEndSection] = useState(2);
  const [viewMode, setViewMode] = useState<'overview' | 'classic'>('overview');
  const [hasSelection, setHasSelection] = useState(false);
  const [overviewSelection, setOverviewSelection] = useState({ day: 1, sections: [1, 2] });
  const [loadError, setLoadError] = useState('');
  const requestId = useRef(0);

  const currentTermId = useAppStore((s) => s.currentTermId);
  const availableTerms = useAppStore((s) => s.availableTerms);
  const setCurrentTermId = useAppStore((s) => s.setCurrentTermId);
  // 【多校区】
  const currentCampus = useAppStore((s) => s.currentCampus);
  const setCurrentCampus = useAppStore((s) => s.setCurrentCampus);
  const [campuses, setCampuses] = useState<string[]>(['河源', '白云']);

  // 【多校区】加载校区列表
  useEffect(() => {
    const tk = localStorage.getItem('auth_token');
    fetch('/api/campuses', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
      .then(r => r.json())
      .then(j => { if (j.success && Array.isArray(j.data)) setCampuses(j.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (currentTermId) params.append('term_id', String(currentTermId));
    if (currentCampus) params.append('campus', currentCampus);
    fetch(`/api/dashboard/stats?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.success) setStats(json.data); })
      .catch(() => {});
  }, [token, currentTermId, currentCampus]);

  const loadFreeTimeData = async () => {
    const id = ++requestId.current;
    try {
      setLoading(true);
      setLoadError('');
      const data = await api.queryFreeTime({
        week: currentWeek,
        department: selectedDepartment || undefined,
        term_id: currentTermId || undefined,
        campus: currentCampus || undefined,
      });
      if (id === requestId.current) setFreeTimeData(data);
    } catch (err) {
      if (id === requestId.current) {
        setFreeTimeData([]);
        setLoadError(err instanceof Error ? err.message : '加载失败，请重试');
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadFreeTimeData();
    return () => { requestId.current++; };
  }, [currentWeek, selectedDepartment, currentTermId, currentCampus]);

  const getCurrentTimeSlot = useMemo(() => {
    if (viewMode === 'overview') {
      return { label: sectionLabel(overviewSelection.sections), sections: overviewSelection.sections, period: '总览' };
    }
    if (useCustomRange) {
      const sections = Array.from(
        { length: customEndSection - customStartSection + 1 },
        (_, i) => customStartSection + i
      );
      return {
        label: sectionLabel(sections),
        sections,
        period: '自定义'
      };
    }
    return TIME_SLOTS[selectedTimeSlotIndex];
  }, [viewMode, overviewSelection, useCustomRange, customStartSection, customEndSection, selectedTimeSlotIndex]);

  const activeDay = viewMode === 'overview' ? overviewSelection.day : selectedDay;
  const currentPeople = peopleForSections(freeTimeData, activeDay, getCurrentTimeSlot.sections);
  const currentCount = currentPeople.length;
  const selectOverviewRange = (day: number, sections: number[]) => {
    setOverviewSelection({ day, sections });
    setHasSelection(true);
  };

  return (
    <div className="pp-dashboard space-y-8 w-full">
      {/* Header */}
      <section className="handbook-heading flex flex-col md:flex-row md:items-end justify-between gap-6">
        <HandbookPageHeading title="空闲统计" description="查看各部门成员的空闲时间分布" art="dashboard" />
        <div className="flex items-center gap-2">
          {/* 【多校区】校区切换 */}
          {campuses.length > 0 && (
            <select
              aria-label="校区"
              value={currentCampus || ''}
              onChange={e => setCurrentCampus(e.target.value)}
              className="px-2 py-1 text-xs rounded-lg bg-surface-container-low border border-surface-container-high"
            >
              {campuses.map(c => (
                <option key={c} value={c}>{c}校区</option>
              ))}
            </select>
          )}
          {availableTerms.length > 0 && (
            <select
              aria-label="学期"
              value={currentTermId || ''}
              onChange={e => setCurrentTermId(Number(e.target.value))}
              className="px-2 py-1 text-xs rounded-lg bg-surface-container-low border border-surface-container-high"
            >
              {availableTerms.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.status === 'active' ? ' (当前)' : ''}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            aria-label="部门"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none pr-10 min-w-[140px]"
          >
            <option value="">全部部门</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.name}>{dept.name}</option>
            ))}
          </select>
          <button
            aria-label="刷新空闲名单"
            title="刷新空闲名单"
            onClick={loadFreeTimeData}
            disabled={loading}
            className="p-2.5 bg-surface-container-low border border-surface-container-high rounded-xl hover:bg-surface-container transition-all"
          >
            <RefreshCw className={cn(loading && "animate-spin")} size={18} />
          </button>
        </div>
      </section>

      <ActivityEntries />

      {/* Stats Banner */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: <Layers size={18} />, label: '课表总数', value: stats.schedules, color: 'text-blue-600 bg-blue-50' },
            { icon: <BookOpen size={18} />, label: '课程总数', value: stats.courses, color: 'text-emerald-600 bg-emerald-50' },
            { icon: <Users size={18} />, label: '活跃用户', value: stats.users, color: 'text-purple-600 bg-purple-50' },
            { icon: <Calendar size={18} />, label: '部门数', value: stats.departments, color: 'text-orange-600 bg-orange-50' },
            { icon: <FolderOpen size={18} />, label: '文件数', value: stats.files, color: 'text-pink-600 bg-pink-50' },
          ].map(s => (
            <div key={s.label} className="handbook-stat bg-surface-container-lowest rounded-2xl border border-surface-container-high p-4 flex items-center gap-3">
              <div className={`handbook-stat-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                {s.icon}
              </div>
              <div>
                <p className="handbook-stat-value text-2xl font-extrabold text-on-surface">{s.value}</p>
                <p className="handbook-stat-label text-xs">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="weekly-mode" aria-label="空闲时间显示方式">
        <button aria-pressed={viewMode === 'overview'} onClick={() => setViewMode('overview')}><CalendarDays size={16} aria-hidden="true" />周总览</button>
        <button aria-pressed={viewMode === 'classic'} onClick={() => setViewMode('classic')}><SlidersHorizontal size={16} aria-hidden="true" />按条件筛选</button>
      </div>

      {viewMode === 'overview' ? <WeeklyFreeTimeOverview data={freeTimeData} week={currentWeek} day={activeDay}
        sections={getCurrentTimeSlot.sections} selected={hasSelection} loading={loading} error={loadError}
        onWeekChange={setCurrentWeek} onSelect={selectOverviewRange} onRetry={loadFreeTimeData} /> : <>
      {loadError && <div role="alert" className="weekly-error"><span>{loadError}</span><button onClick={loadFreeTimeData}>重试</button></div>}
      {/* Original selectors remain available for comparison. */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Week selector */}
        <div className="handbook-sheet sheet-week md:col-span-4 bento-card">
          <div className="handbook-sheet-heading flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface font-headline"><Calendar size={17} aria-hidden="true" />选择周次</h3>
            <span className="text-sm text-on-surface-variant">共18周</span>
          </div>
          <WeekSelector currentWeek={currentWeek} onWeekChange={setCurrentWeek} />
        </div>

        {/* Time slot selector */}
        <div className="handbook-sheet sheet-time md:col-span-4 bento-card">
          <div className="handbook-sheet-heading flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface font-headline"><Clock size={17} aria-hidden="true" />时间段选择</h3>
            <button
              onClick={() => setUseCustomRange(!useCustomRange)}
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-full transition-all",
                useCustomRange
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant"
              )}
            >
              {useCustomRange ? '自定义' : '预设'}
            </button>
          </div>
          <TimeSlotSelector
            selectedIndex={selectedTimeSlotIndex}
            onIndexChange={index => { setSelectedTimeSlotIndex(index); setUseCustomRange(false); }}
            useCustomRange={useCustomRange}
            onToggleCustomRange={() => setUseCustomRange(!useCustomRange)}
            customStartSection={customStartSection}
            customEndSection={customEndSection}
            onCustomStartChange={start => { setCustomStartSection(start); setCustomEndSection(end => Math.max(end, start)); }}
            onCustomEndChange={setCustomEndSection}
          />
        </div>

        {/* Day selector */}
        <div className="handbook-sheet sheet-day md:col-span-4 bento-card">
          <div className="handbook-sheet-heading flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface font-headline"><CalendarDays size={17} aria-hidden="true" />选择星期</h3>
            <span className="text-sm text-on-surface-variant">共7天</span>
          </div>
          <DaySelector selectedDay={selectedDay} onDayChange={setSelectedDay} />
          <div className="mt-4 bg-primary/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black text-primary font-headline">{currentCount}</div>
            <div className="text-sm text-on-surface-variant mt-1">人空闲</div>
          </div>
        </div>
      </div>
      </>}

      {/* Free time grid */}
      {(viewMode === 'classic' || hasSelection) && !loadError && <FreeTimeGrid
        people={currentPeople}
        week={currentWeek}
        day={activeDay}
        timeSlotLabel={getCurrentTimeSlot.label}
        department={selectedDepartment || undefined}
        loading={loading}
      />}

      {/* Stats explanation */}
      {viewMode === 'classic' && <div className="bg-surface-container-lowest rounded-2xl shadow-lg border border-surface-container-high p-6">
        <h3 className="font-bold text-lg text-on-surface font-headline mb-4">统计说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-on-surface-variant">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-medium text-on-surface">周次选择</p>
              <p>支持选择第1-18周，默认显示第1周</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-medium text-on-surface">时间段选择</p>
              <p>预设5个时间段，或自定义节次范围</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users size={16} className="text-primary" />
            </div>
            <div>
              <p className="font-medium text-on-surface">空闲名单</p>
              <p>显示该时间段无课程安排的人员</p>
            </div>
          </div>
        </div>
      </div>}

    </div>
  );
}
