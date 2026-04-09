import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Calendar,
  User,
  Target,
  Check
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { 
  Department, 
  FreeTimeResult,
  TIME_SLOTS,
  WEEKDAYS
} from '@/types';
import { api } from '@/services/api';

const CURRENT_WEEK_KEY = 'schedule_current_week';

export default function DashboardView() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [actualCurrentWeek, setActualCurrentWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedTimeSlotIndex, setSelectedTimeSlotIndex] = useState(0);
  const [freeTimeData, setFreeTimeData] = useState<FreeTimeResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [customStartSection, setCustomStartSection] = useState(1);
  const [customEndSection, setCustomEndSection] = useState(2);
  const [useCustomRange, setUseCustomRange] = useState(false);

  useEffect(() => {
    loadDepartments();
    const saved = localStorage.getItem(CURRENT_WEEK_KEY);
    if (saved) {
      setActualCurrentWeek(parseInt(saved));
    }
  }, []);

  useEffect(() => {
    loadFreeTimeData();
  }, [currentWeek, selectedDepartment]);

  const loadDepartments = async () => {
    try {
      const data = await api.getDepartments();
      setDepartments(data);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

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

  const jumpToCurrentWeek = () => {
    if (actualCurrentWeek) {
      setCurrentWeek(actualCurrentWeek);
    }
  };

  const getFreePeopleForSlot = (day: number, sections: number[]): Array<{ name: string; department: string }> => {
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

  const getTimeSlotFreeCount = (day: number, sections: number[]): number => {
    return getFreePeopleForSlot(day, sections).length;
  };

  const getCurrentTimeSlot = () => {
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
  };

  const currentPeople = getFreePeopleForSlot(selectedDay, getCurrentTimeSlot().sections);
  const currentCount = currentPeople.length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold text-on-surface font-headline tracking-tight">空闲统计</h1>
          <p className="text-on-surface-variant font-medium">查看各部门成员的空闲时间分布</p>
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
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-4 bento-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface font-headline">选择周次</h3>
            <div className="flex items-center gap-2">
              {actualCurrentWeek && (
                <button
                  onClick={jumpToCurrentWeek}
                  className="text-xs font-medium px-3 py-1 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-all flex items-center gap-1"
                >
                  <Target size={12} />
                  当前第{actualCurrentWeek}周
                </button>
              )}
              <span className="text-sm text-on-surface-variant">共18周</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
              disabled={currentWeek <= 1}
              className="p-2 bg-surface-container-low rounded-lg hover:bg-surface-container disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 text-center relative">
              <div className="text-4xl font-black text-primary font-headline">第{currentWeek}周</div>
              {actualCurrentWeek === currentWeek && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </div>
            <button
              onClick={() => setCurrentWeek(Math.min(18, currentWeek + 1))}
              disabled={currentWeek >= 18}
              className="p-2 bg-surface-container-low rounded-lg hover:bg-surface-container disabled:opacity-30 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-1">
            {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
              <button
                key={week}
                onClick={() => setCurrentWeek(week)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleSetCurrentWeek(week);
                }}
                className={cn(
                  "py-1.5 text-xs font-medium rounded transition-all relative",
                  currentWeek === week
                    ? "bg-primary text-on-primary"
                    : actualCurrentWeek === week
                      ? "bg-green-500 text-white"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                )}
              >
                {week}
                {actualCurrentWeek === week && currentWeek !== week && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full ring-2 ring-white"></span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-on-surface-variant">
            <span>点击选择周次</span>
            <span>右键设为当前周</span>
          </div>
        </div>

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

          {!useCustomRange ? (
            <div className="space-y-2">
              {TIME_SLOTS.map((slot, index) => (
                <button
                  key={slot.label}
                  onClick={() => setSelectedTimeSlotIndex(index)}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-left transition-all flex items-center justify-between",
                    selectedTimeSlotIndex === index
                      ? "bg-primary text-on-primary shadow-lg shadow-primary/20"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  <div>
                    <span className="font-medium">{slot.label}</span>
                    <span className={cn(
                      "text-xs ml-2",
                      selectedTimeSlotIndex === index ? "text-on-primary/80" : "text-outline"
                    )}>
                      {slot.period}
                    </span>
                  </div>
                  <Clock size={16} className={cn(
                    selectedTimeSlotIndex === index ? "text-on-primary/80" : "text-outline"
                  )} />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-on-surface-variant mb-2">开始节次</label>
                  <select
                    value={customStartSection}
                    onChange={(e) => setCustomStartSection(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 1).map(s => (
                      <option key={s} value={s}>第{s}节</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-on-surface-variant mb-2">结束节次</label>
                  <select
                    value={customEndSection}
                    onChange={(e) => setCustomEndSection(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 1).map(s => (
                      <option key={s} value={s} disabled={s < customStartSection}>第{s}节</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-primary/10 rounded-xl p-4 text-center">
                <span className="text-primary font-medium">
                  第{customStartSection}-{customEndSection}节
                </span>
                <span className="text-on-surface-variant text-sm ml-2">
                  ({customEndSection - customStartSection + 1}节课)
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-4 bento-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-on-surface font-headline">选择星期</h3>
            <span className="text-sm text-on-surface-variant">共7天</span>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setSelectedDay(Math.max(1, selectedDay - 1))}
              disabled={selectedDay <= 1}
              className="p-2 bg-surface-container-low rounded-lg hover:bg-surface-container disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 text-center">
              <div className="text-4xl font-black text-primary font-headline">{WEEKDAYS[selectedDay - 1]}</div>
            </div>
            <button
              onClick={() => setSelectedDay(Math.min(7, selectedDay + 1))}
              disabled={selectedDay >= 7}
              className="p-2 bg-surface-container-low rounded-lg hover:bg-surface-container disabled:opacity-30 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day, index) => (
              <button
                key={day}
                onClick={() => setSelectedDay(index + 1)}
                className={cn(
                  "py-2 text-xs font-medium rounded transition-all",
                  selectedDay === index + 1
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                )}
              >
                {day.replace('周', '')}
              </button>
            ))}
          </div>

          <div className="mt-4 bg-primary/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black text-primary font-headline">{currentCount}</div>
            <div className="text-sm text-on-surface-variant mt-1">人空闲</div>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-lg border border-surface-container-high overflow-hidden">
        <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-on-surface font-headline">
              第{currentWeek}周 · {WEEKDAYS[selectedDay - 1]} · {getCurrentTimeSlot().label} 空闲名单
            </h3>
            <p className="text-sm text-on-surface-variant mt-1">
              {selectedDepartment ? `${selectedDepartment} · ` : '全部部门 · '}
              共 {currentCount} 人空闲
            </p>
          </div>
          {loading && (
            <RefreshCw className="animate-spin text-primary" size={20} />
          )}
        </div>

        <div className="p-6">
          {currentPeople.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant">
              <Users className="mx-auto mb-4 text-outline" size={48} />
              <p className="text-lg font-medium">暂无空闲人员</p>
              <p className="text-sm mt-2">该时间段没有空闲的成员</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {currentPeople.map((person, index) => (
                <motion.div
                  key={`${person.name}-${index}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="bg-surface-container-low rounded-xl p-4 border border-surface-container-high hover:border-primary/30 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg mb-2">
                      {person.name.charAt(0)}
                    </div>
                    <p className="font-medium text-on-surface text-sm truncate w-full">{person.name}</p>
                    <p className="text-xs text-on-surface-variant truncate w-full mt-0.5">{person.department}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

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
