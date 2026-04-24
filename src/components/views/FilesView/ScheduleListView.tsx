import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FileSpreadsheet, Search, X, RefreshCw, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScheduleData, Department } from '@/types';
import { staggerContainer, staggerItem, DepartmentStat } from './constants';
import { filterSchedules, calculateDepartmentStats, formatRelativeTime } from './utils';
import ScheduleItem from './ScheduleItem';
import StatsCards from './StatsCards';

interface ScheduleListViewProps {
  schedules: ScheduleData[];
  loading: boolean;
  departments: Department[];
  filterDepartment: string;
  onFilterDepartmentChange: (dept: string) => void;
  searchName: string;
  onSearchNameChange: (name: string) => void;
  showSearch: boolean;
  onToggleSearch: () => void;
  onUploadClick: () => void;
  onManualEntryClick: () => void;
  onViewSchedule: (schedule: ScheduleData) => void;
  onDeleteSchedule: (id: number) => void;
}

export default function ScheduleListView({
  schedules,
  loading,
  departments,
  filterDepartment,
  onFilterDepartmentChange,
  searchName,
  onSearchNameChange,
  showSearch,
  onToggleSearch,
  onUploadClick,
  onManualEntryClick,
  onViewSchedule,
  onDeleteSchedule
}: ScheduleListViewProps) {
  const filteredSchedules = useMemo(
    () => filterSchedules(schedules, filterDepartment, searchName),
    [schedules, filterDepartment, searchName]
  );

  const departmentStats: DepartmentStat[] = useMemo(
    () => calculateDepartmentStats(schedules, departments),
    [schedules, departments]
  );

  const recentSchedules = useMemo(
    () =>
      [...schedules]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [schedules]
  );

  return (
    <motion.div
      key="list"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 w-full"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
              <FileSpreadsheet className="text-on-primary" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-on-surface tracking-tight">课表中心</h1>
              <p className="text-sm text-on-surface-variant">上传识别、编辑管理和查询统计课表</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onManualEntryClick}
            className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 transition-all flex items-center gap-2"
          >
            <FileText size={18} />
            手动录入
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onUploadClick}
            className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 text-on-primary font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all flex items-center gap-2"
          >
            上传课表
          </motion.button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards schedules={schedules} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main list area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
            {/* Filter bar */}
            <div className="p-4 border-b border-surface-container-high bg-gradient-to-r from-surface-container-low/50 to-transparent">
              <div className="flex items-center justify-between gap-3">
                {/* Department filter pills */}
                <div className="flex items-center gap-2 overflow-x-auto flex-1 pb-1">
                  <button
                    onClick={() => onFilterDepartmentChange('')}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                      filterDepartment === ''
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    )}
                  >
                    全部
                  </button>
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => onFilterDepartmentChange(dept.name)}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
                        filterDepartment === dept.name
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      )}
                    >
                      {dept.name}
                    </button>
                  ))}
                </div>

                {/* Search toggle */}
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {showSearch && (
                      <motion.input
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 200, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        type="text"
                        placeholder="搜索姓名..."
                        value={searchName}
                        onChange={(e) => onSearchNameChange(e.target.value)}
                        autoFocus
                        className="px-4 py-2 bg-surface-container-low border border-surface-container-high rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-sm"
                      />
                    )}
                  </AnimatePresence>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (showSearch && searchName) {
                        onSearchNameChange('');
                      }
                      onToggleSearch();
                    }}
                    className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"
                  >
                    {showSearch && searchName ? (
                      <X className="text-primary" size={18} />
                    ) : (
                      <Search className="text-primary" size={18} />
                    )}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Schedule list */}
            {loading ? (
              <div className="p-12 text-center">
                <RefreshCw className="animate-spin mx-auto text-primary mb-3" size={32} />
                <p className="text-on-surface-variant">加载中...</p>
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-container-low mx-auto mb-4 flex items-center justify-center">
                  <FileText className="text-outline" size={32} />
                </div>
                <p className="text-on-surface-variant font-medium">暂无课表数据</p>
                <p className="text-sm text-outline mt-1">点击上方按钮上传课表</p>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-480px)] overflow-y-auto">
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-surface-container-high"
                >
                  {filteredSchedules.map((schedule) => (
                    <ScheduleItem
                      key={schedule.id}
                      schedule={schedule}
                      onView={onViewSchedule}
                      onDelete={onDeleteSchedule}
                    />
                  ))}
                </motion.div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Department stats */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm p-5">
            <h3 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
              <TrendingUp className="text-primary" size={18} />
              课表上传情况
            </h3>
            {departmentStats.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-4">暂无数据</p>
            ) : (
              <div className="space-y-2">
                {departmentStats.map((dept, index) => {
                  const colors = ['text-primary', 'text-blue-500', 'text-green-500', 'text-amber-500', 'text-purple-500'];
                  return (
                    <div key={dept.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-colors">
                      <span className="text-sm text-on-surface-variant">{dept.name}</span>
                      <span className={cn("font-bold text-lg", colors[index % colors.length])}>{dept.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent uploads */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm p-5">
            <h3 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
              <Clock className="text-amber-500" size={18} />
              最近上传
            </h3>
            {recentSchedules.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-4">暂无数据</p>
            ) : (
              <div className="space-y-3">
                {recentSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
                    onClick={() => onViewSchedule(schedule)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="text-primary" size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{schedule.name}</p>
                      <p className="text-xs text-on-surface-variant">{formatRelativeTime(schedule.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
