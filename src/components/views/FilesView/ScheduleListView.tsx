import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FileSpreadsheet, Search, X, Plus, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScheduleData, Department } from '@/types';
import { filterSchedules } from './utils';
import ScheduleItem from './ScheduleItem';
import { SkeletonList } from '@/components/Skeleton';
import { useAuthStore } from '@/stores/authStore';

interface ScheduleListViewProps {
  schedules: ScheduleData[];
  loading: boolean;
  departments: Department[];
  onUploadClick: () => void;
  onManualEntryClick: () => void;
  onViewSchedule: (schedule: ScheduleData) => void;
  onDeleteSchedule: (id: number) => void;
}

function EmptyState({
  onUploadClick,
  onManualEntryClick
}: {
  onUploadClick: () => void;
  onManualEntryClick: () => void;
}) {
  return (
    <div className="empty-state">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="empty-state-icon"
      >
        <FileSpreadsheet className="text-outline" size={32} />
      </motion.div>
      <p className="empty-state-title">暂无课表数据</p>
      <p className="empty-state-description">上传课表或手动录入开始</p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-3 mt-6"
      >
        <button
          onClick={onManualEntryClick}
          className="focus-ring flex items-center gap-2 px-4 py-2.5 bg-surface-container-low text-on-surface-variant rounded-xl hover:bg-surface-container transition-all"
        >
          <Plus size={16} />
          手动录入
        </button>
        <button
          onClick={onUploadClick}
          className="focus-ring flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-all"
        >
          <Upload size={16} />
          上传课表
        </button>
      </motion.div>
    </div>
  );
}

function ScheduleGrid({
  schedules,
  onViewSchedule,
  onDeleteSchedule
}: {
  schedules: ScheduleData[];
  onViewSchedule: (schedule: ScheduleData) => void;
  onDeleteSchedule: (id: number) => void;
}) {
  const user = useAuthStore((s) => s.user);

  function canModify(schedule: ScheduleData): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.department === '秘书部' || user.department === '主任团') return true;
    return (schedule as any).created_by === user.username;
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.05 }
        }
      }}
      className="p-4"
    >
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-w-0">
        {schedules.map((schedule) => (
          <motion.div
            key={schedule.id}
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } }
            }}
          >
            <ScheduleItem
              schedule={schedule}
              onView={onViewSchedule}
              onDelete={onDeleteSchedule}
              canDelete={canModify(schedule)}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

export default function ScheduleListView({
  schedules,
  loading,
  departments,
  onUploadClick,
  onManualEntryClick,
  onViewSchedule,
  onDeleteSchedule
}: ScheduleListViewProps) {
  const [filterDepartment, setFilterDepartment] = useState('');
  const [searchName, setSearchName] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const filteredSchedules = useMemo(
    () => filterSchedules(schedules, filterDepartment, searchName),
    [schedules, filterDepartment, searchName]
  );

  return (
    <motion.div
      key="list"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-4 w-full"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30"
          >
            <FileSpreadsheet className="text-on-primary" size={24} />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline">课表中心</h1>
            <p className="text-sm text-on-surface-variant">
              {schedules.length > 0 ? `共 ${schedules.length} 条课表` : '管理您的课表数据'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onManualEntryClick}
            className="focus-ring flex items-center gap-2 px-5 py-2.5 bg-surface-container-low text-on-surface font-medium rounded-xl hover:bg-surface-container-high transition-all"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">手动录入</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onUploadClick}
            className="focus-ring flex items-center gap-2 px-5 py-2.5 btn-primary"
          >
            <Upload size={18} />
            <span className="hidden sm:inline">上传课表</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm overflow-hidden"
        >
          {/* Filter bar */}
          <div className="p-3 sm:p-4 border-b border-surface-container-high">
            <div className="flex items-center justify-between gap-3">
              {/* Department filter pills */}
              <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 pb-1">
                <button
                  onClick={() => setFilterDepartment('')}
                  className={cn(
                    "focus-ring px-3 sm:px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap",
                    filterDepartment === ''
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  全部
                </button>
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => setFilterDepartment(dept.name)}
                    className={cn(
                      "focus-ring px-3 sm:px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap",
                      filterDepartment === dept.name
                        ? "bg-primary text-on-primary shadow-sm"
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
                      animate={{ width: 160, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      type="text"
                      placeholder="搜索姓名..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      autoFocus
                      className="focus-ring px-3 py-2 bg-surface-container-low border border-surface-container-high rounded-xl focus:border-primary outline-none transition-all text-sm"
                    />
                  )}
                </AnimatePresence>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (showSearch && searchName) {
                      setSearchName('');
                    }
                    setShowSearch(!showSearch);
                  }}
                  className="focus-ring w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center hover:bg-surface-container transition-all"
                >
                  {showSearch && searchName ? (
                    <X className="text-on-surface-variant" size={18} />
                  ) : (
                    <Search className="text-on-surface-variant" size={18} />
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          {/* Schedule list */}
          {loading ? (
            <div className="p-4">
              <SkeletonList count={8} />
            </div>
          ) : filteredSchedules.length === 0 ? (
            <EmptyState
              onUploadClick={onUploadClick}
              onManualEntryClick={onManualEntryClick}
            />
          ) : (
            <ScheduleGrid
              schedules={filteredSchedules}
              onViewSchedule={onViewSchedule}
              onDeleteSchedule={onDeleteSchedule}
            />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}