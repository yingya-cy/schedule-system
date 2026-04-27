import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Check, Plus, Trash2 } from 'lucide-react';
import { EditableCourse, WEEKDAYS, SECTION_TIMES } from '@/types';
import { WeekRange } from './constants';
import { parseWeeksFromRanges, weeksToRanges, formatWeeksDisplay, parseSectionInput } from './utils';
import { cn } from '@/lib/utils';

interface CourseEditModalProps {
  course: EditableCourse;
  onSave: (course: EditableCourse) => void;
  onClose: () => void;
  isNew?: boolean;
}

export default function CourseEditModal({
  course,
  onSave,
  onClose,
  isNew = false
}: CourseEditModalProps) {
  const [editingCourse, setEditingCourse] = useState<EditableCourse>(course);
  const [weekRanges, setWeekRanges] = useState<WeekRange[]>(() => weeksToRanges(course.weeks));
  const [sectionInput, setSectionInput] = useState<string>(() => {
    if (course.sections.length === 0) return '';
    return `${course.sections[0]}-${course.sections[course.sections.length - 1]}`;
  });

  useEffect(() => {
    const weeks = parseWeeksFromRanges(weekRanges);
    setEditingCourse(prev => ({ ...prev, weeks }));
  }, [weekRanges]);

  const handleSectionInputChange = (value: string) => {
    setSectionInput(value);
    const sections = parseSectionInput(value);
    if (sections.length > 0) {
      setEditingCourse(prev => ({ ...prev, sections }));
    }
  };

  const addWeekRange = () => {
    setWeekRanges(prev => [...prev, {
      id: `range-${Date.now()}`,
      start: null,
      end: null,
      type: 'all'
    }]);
  };

  const updateWeekRange = (id: string, field: 'start' | 'end' | 'type', value: number | null | string) => {
    setWeekRanges(prev => prev.map(r =>
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const removeWeekRange = (id: string) => {
    setWeekRanges(prev => prev.filter(r => r.id !== id));
  };

  const handleSave = () => {
    if (!editingCourse.course_name) return;
    onSave(editingCourse);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-surface-container-lowest rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-surface-container-high flex justify-between items-center">
          <h3 className="font-bold text-lg text-on-surface font-headline">
            {isNew ? '添加新课程' : '编辑课程'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-lg transition-colors focus-ring">
            <X size={20} className="text-outline" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">
              课程名称 {!isNew && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={editingCourse.course_name}
              onChange={(e) => setEditingCourse({ ...editingCourse, course_name: e.target.value })}
              placeholder="请输入课程名称"
              className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none focus-ring"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">星期</label>
              <select
                value={editingCourse.weekday}
                onChange={(e) => setEditingCourse({ ...editingCourse, weekday: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none focus-ring"
              >
                {WEEKDAYS.map((day, index) => (
                  <option key={day} value={index + 1}>{day}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">节次</label>
              <input
                type="text"
                value={sectionInput}
                onChange={(e) => handleSectionInputChange(e.target.value)}
                placeholder="例如: 1-2 或 3-4"
                className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none focus-ring"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {SECTION_TIMES.map(s => (
                  <button
                    key={s.section}
                    type="button"
                    onClick={() => {
                      const sections = editingCourse.sections.includes(s.section)
                        ? editingCourse.sections.filter(sec => sec !== s.section)
                        : [...editingCourse.sections, s.section].sort((a, b) => a - b);
                      setEditingCourse({ ...editingCourse, sections });
                      if (sections.length > 0) {
                        setSectionInput(`${sections[0]}-${sections[sections.length - 1]}`);
                      }
                    }}
                    className={cn(
                      "px-2 py-1 text-xs font-medium rounded transition-colors focus-ring touch-target",
                      editingCourse.sections.includes(s.section)
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    )}
                  >
                    {s.section}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-on-surface-variant">周次</label>
              <button
                type="button"
                onClick={addWeekRange}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 focus-ring"
              >
                <Plus size={14} />
                添加周数范围
              </button>
            </div>

            <div className="space-y-2">
              {weekRanges.length === 0 ? (
                <div className="text-sm text-on-surface-variant py-2 text-center bg-surface-container-low rounded-lg">
                  未设置周次，请添加周数范围
                </div>
              ) : (
                weekRanges.map((range) => (
                  <div key={range.id} className="flex items-center gap-2 p-2 bg-surface-container-low rounded-lg">
                    <input
                      type="number"
                      min={1}
                      max={18}
                      value={range.start ?? ''}
                      onChange={(e) => updateWeekRange(range.id, 'start', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="起始"
                      className="w-16 px-2 py-1.5 text-sm border border-surface-container-high rounded focus:ring-2 focus:ring-primary outline-none text-center focus-ring"
                    />
                    <span className="text-on-surface-variant">—</span>
                    <input
                      type="number"
                      min={1}
                      max={18}
                      value={range.end ?? ''}
                      onChange={(e) => updateWeekRange(range.id, 'end', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="结束"
                      className="w-16 px-2 py-1.5 text-sm border border-surface-container-high rounded focus:ring-2 focus:ring-primary outline-none text-center focus-ring"
                    />
                    <span className="text-on-surface-variant">周</span>
                    <select
                      value={range.type}
                      onChange={(e) => updateWeekRange(range.id, 'type', e.target.value)}
                      className="px-2 py-1.5 text-sm border border-surface-container-high rounded focus:ring-2 focus:ring-primary outline-none focus-ring"
                    >
                      <option value="all">无</option>
                      <option value="odd">单周</option>
                      <option value="even">双周</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeWeekRange(range.id)}
                      className="p-1 text-on-surface-variant hover:text-red-500 transition-colors focus-ring"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {editingCourse.weeks.length > 0 && (
              <div className="mt-2 text-xs text-on-surface-variant">
                已选: <span className="text-on-surface font-medium">{formatWeeksDisplay(editingCourse.weeks)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">教师</label>
              <input
                type="text"
                value={editingCourse.teacher}
                onChange={(e) => setEditingCourse({ ...editingCourse, teacher: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none focus-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">地点</label>
              <input
                type="text"
                value={editingCourse.location}
                onChange={(e) => setEditingCourse({ ...editingCourse, location: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none focus-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">备注</label>
            <textarea
              value={editingCourse.remark}
              onChange={(e) => setEditingCourse({ ...editingCourse, remark: e.target.value })}
              className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none focus-ring"
              rows={2}
            />
          </div>
        </div>

        <div className="p-6 border-t border-surface-container-high flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-low text-on-surface-variant font-medium rounded-lg hover:bg-surface-container transition-all focus-ring"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!editingCourse.course_name}
            className="px-4 py-2 bg-primary text-on-primary font-semibold rounded-lg hover:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 focus-ring"
          >
            <Check size={16} />
            {isNew ? '添加课程' : '保存修改'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
