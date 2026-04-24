import React from 'react';
import { motion } from 'motion/react';
import { Edit3, Trash2, Calendar, Clock, MapPin, User } from 'lucide-react';
import { EditableCourse, WEEKDAYS } from '@/types';
import { getCourseColor, formatWeeksDisplay } from './utils';
import { cn } from '@/lib/utils';

interface CourseListItemProps {
  course: EditableCourse;
  currentWeek: number;
  courseIndex: number;
  onEdit: (course: EditableCourse) => void;
  onDelete: (courseId: string) => void;
}

export default function CourseListItem({
  course,
  currentWeek,
  courseIndex,
  onEdit,
  onDelete
}: CourseListItemProps) {
  const bgColor = getCourseColor(courseIndex);
  const isInCurrentWeek = course.weeks.includes(currentWeek);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "p-3 rounded-xl border transition-all cursor-pointer group",
        isInCurrentWeek
          ? "bg-surface-container-low border-surface-container-high hover:border-primary/30"
          : "bg-surface-container-lowest/50 border-surface-container-high/50 opacity-60"
      )}
      onClick={() => onEdit(course)}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-3 h-full min-h-[40px] rounded-full flex-shrink-0"
          style={{ backgroundColor: bgColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-on-surface text-sm truncate">
              {course.course_name}
            </p>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(course); }}
                className="p-1 hover:bg-surface-container rounded transition-colors"
              >
                <Edit3 size={12} className="text-on-surface-variant" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(course.id); }}
                className="p-1 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 size={12} className="text-red-500" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {WEEKDAYS[course.weekday - 1]}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {course.sections.length > 0
                ? `第${course.sections[0]}-${course.sections[course.sections.length - 1]}节`
                : '未设置节次'}
            </span>
            {course.location && (
              <span className="flex items-center gap-1">
                <MapPin size={10} />
                {course.location}
              </span>
            )}
          </div>
          {course.teacher && (
            <div className="flex items-center gap-1 mt-1 text-xs text-on-surface-variant">
              <User size={10} />
              {course.teacher}
            </div>
          )}
          <div className="mt-1.5 text-xs text-on-surface-variant">
            <span className="font-medium">周次: </span>
            <span className="text-on-surface">{formatWeeksDisplay(course.weeks)}</span>
          </div>
        </div>
      </div>
      {(course.isNew || course.isModified) && (
        <div className="mt-2 flex gap-1">
          {course.isNew && (
            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-600 rounded-full">新增</span>
          )}
          {course.isModified && (
            <span className="text-[10px] px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded-full">已修改</span>
          )}
        </div>
      )}
    </motion.div>
  );
}
