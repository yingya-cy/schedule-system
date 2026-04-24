import React from 'react';
import { Edit3, Trash2, GripVertical } from 'lucide-react';
import { EditableCourse } from '@/types';
import { getCourseColor } from './utils';
import { cn } from '@/lib/utils';
import { CELL_HEIGHT } from './constants';

interface CourseBlockProps {
  course: EditableCourse;
  sectionIndex: number;
  courseIndex: number;
  onEdit: (course: EditableCourse) => void;
  onDelete: (courseId: string) => void;
  onDragStart: (e: React.DragEvent, course: EditableCourse) => void;
}

export default function CourseBlock({
  course,
  sectionIndex,
  courseIndex,
  onEdit,
  onDelete,
  onDragStart
}: CourseBlockProps) {
  const isFirstSection = course.sections[0] === sectionIndex + 1;
  if (!isFirstSection) return null;

  const rowSpan = course.sections.length;
  const bgColor = getCourseColor(courseIndex);
  const blockHeight = CELL_HEIGHT * rowSpan + (rowSpan - 1) * 1;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, course)}
      className={cn(
        "absolute left-0 right-0 m-0.5 rounded-lg p-2 cursor-grab active:cursor-grabbing group",
        "flex flex-col overflow-hidden transition-transform hover:scale-[1.02]",
        course.isNew && "ring-2 ring-green-400",
        course.isModified && "ring-2 ring-yellow-400"
      )}
      style={{
        backgroundColor: bgColor,
        height: blockHeight,
        zIndex: 10
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-bold truncate drop-shadow-sm">
            {course.course_name}
          </p>
          {course.location && (
            <p className="text-white/80 text-[10px] truncate mt-0.5">
              {course.location}
            </p>
          )}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(course); }}
            className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
          >
            <Edit3 size={10} className="text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(course.id); }}
            className="p-1 bg-white/20 rounded hover:bg-red-500/50 transition-colors"
          >
            <Trash2 size={10} className="text-white" />
          </button>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical size={10} className="text-white/50" />
      </div>
    </div>
  );
}
