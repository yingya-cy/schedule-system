import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Calendar, Users, Clock, BookOpen, FolderOpen, Layers, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FreeTimeResult, TIME_SLOTS, WEEKDAYS } from '@/types';
import { api } from '@/services/api';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import WeekSelector from '@/components/WeekSelector';
import DaySelector from '@/components/DaySelector';
import TimeSlotSelector from '@/components/TimeSlotSelector';
import FreeTimeGrid from '@/components/FreeTimeGrid';

const CURRENT_WEEK_KEY = 'schedule_current_week';

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
  const [actualCurrentWeek, setActualCurrentWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedTimeSlotIndex, setSelectedTimeSlotIndex] = useState(0);
  const [freeTimeData, setFreeTimeData] = useState<FreeTimeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [currentTerm, setCurrentTerm] = useState<string>('');

  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customStartSection, setCustomStartSection] = useState(1);
  const [customEndSection, setCustomEndSection] = useState(2);

  useEffect(() => {
    fetch('/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.success) setStats(json.data); })
      .catch(() => {});
    fetch('/api/terms/current')
      .then(r => r.json())
      .then(json => { if (json.success && json.data) setCurrentTerm(json.data.name); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const saved = localStorage.getItem(CURRENT_WEEK_KEY);
    if (saved) {
      setActualCurrentWeek(parseInt(saved));
    }
  }, []);

  useEffect(() => {
    loadFreeTimeData();
  }, [currentWeek, selectedDepartment]);

  const loadFreeTimeData = async () => {
    try {
      setLoading(true);
      const data = await api.queryFreeTime({
        week: currentWeek,
        department: selectedDepartment || undefined
      });
      setFreeTimeData(data);
    } catch (err) {
      console.error('Failed to load free time data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrentWeek = (week: number) => {
    setActualCurrentWeek(week);
    localStorage.setItem(CURRENT_WEEK_KEY, String(week));
  };

  const getCurrentTimeSlot = useMemo(() => {
    if (useCustomRange) {
      const sections = Array.from(
        { length: customEndSection - customStartSection + 1 },
        (_, i) => customStartSection + i
      );
      return {
        label: `第${customStartSection}-${customEndSection}节`,
        sections,
        period: '自定义'
      };
    }
    return TIME_SLOTS[selectedTimeSlotIndex];
  }, [useCustomRange, customStartSection, customEndSection, selectedTimeSlotIndex]);

  const getFreePeopleForSlot = (day: number, sections: number[]) => {
    const peopleMap = new Map<string, { name: string; department: string }>();

    for (const section of sections) {
      const result = freeTimeData.find(
        r => r.day === day && r.section === section
      );

      if (result) {
        for (const person of result.free_people) {
          peopleMap.set(person.name, person);
        }
      }
    }

    return Array.from(peopleMap.values());
  };

  const currentPeople = getFreePeopleForSlot(selectedDay, getCurrentTimeSlot.sections);
  const currentCount = currentPeople.length;

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold text-on-surface font-headline tracking-tight">空闲统计</h1>
          <p className="text-on-surface-variant font-medium">查看各部门成员的空闲时间分布</p>
          {currentTerm && <span className="inline-block mt-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{currentTerm}</span>}
        </div>
        <div className="flex items-center gap-3">
          <select
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
            onClick={loadFreeTimeData}
            disabled={loading}
            className="p-2.5 bg-surface-container-low border border-surface-container-high rounded-xl hover:bg-surface-container transition-all"
          >
            <RefreshCw className={cn(loading && "animate-spin")} size={18} />
          </button>
          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem('auth_token');
                const res = await fetch('/api/export/reverse-schedule', {
                  method: 'POST',
                  headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
                });
                if (!res.ok) throw new Error('导出失败');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = 'reverse-schedule.xlsx'; a.click();
                URL.revokeObjectURL(url);
              } catch { /* ignore */ }
            }}
            className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5"
          >
            <Download size={14} />
            导出反课表
          </button>
        </div>
      </section>

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
            <div key={s.label} className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-extrabold text-on-surface font-headline">{s.value}</p>
                <p className="text-xs text-outline">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selector cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Week selector */}
        <div className="md:col-span-4 bento-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface font-headline">选择周次</h3>
            <span className="text-sm text-on-surface-variant">共18周</span>
          </div>
          <WeekSelector
            currentWeek={currentWeek}
            actualCurrentWeek={actualCurrentWeek}
            onWeekChange={setCurrentWeek}
            onSetActualWeek={handleSetCurrentWeek}
          />
        </div>

        {/* Time slot selector */}
        <div className="md:col-span-4 bento-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface font-headline">时间段选择</h3>
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
            onIndexChange={setSelectedTimeSlotIndex}
            useCustomRange={useCustomRange}
            onToggleCustomRange={() => setUseCustomRange(!useCustomRange)}
            customStartSection={customStartSection}
            customEndSection={customEndSection}
            onCustomStartChange={setCustomStartSection}
            onCustomEndChange={setCustomEndSection}
          />
        </div>

        {/* Day selector */}
        <div className="md:col-span-4 bento-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface font-headline">选择星期</h3>
            <span className="text-sm text-on-surface-variant">共7天</span>
          </div>
          <DaySelector selectedDay={selectedDay} onDayChange={setSelectedDay} />
          <div className="mt-4 bg-primary/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black text-primary font-headline">{currentCount}</div>
            <div className="text-sm text-on-surface-variant mt-1">人空闲</div>
          </div>
        </div>
      </div>

      {/* Free time grid */}
      <FreeTimeGrid
        people={currentPeople}
        week={currentWeek}
        day={selectedDay}
        timeSlotLabel={getCurrentTimeSlot.label}
        department={selectedDepartment || undefined}
        loading={loading}
      />

      {/* Stats explanation */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-lg border border-surface-container-high p-6">
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
      </div>
    </div>
  );
}
