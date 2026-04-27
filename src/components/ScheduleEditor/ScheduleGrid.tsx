import React from 'react';
import { AnimatePresence } from 'motion/react';
import { EditableCourse, WEEKDAYS, SECTION_TIMES } from '@/types';
import CourseBlock from './CourseBlock';
import { cn } from '@/lib/utils';

interface ScheduleGridProps {
  courses: EditableCourse[];
  currentWeek: number;
  dragOverCell: { weekday: number; section: number } | null;
  onDragOver: (e: React.DragEvent, weekday: number, section: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, weekday: number, section: number) => void;
  onEditCourse: (course: EditableCourse) => void;
  onDeleteCourse: (courseId: string) => void;
  onDragStart: (e: React.DragEvent, course: EditableCourse) => void;
}

export default function ScheduleGrid({
  courses,
  currentWeek,
  dragOverCell,
  onDragOver,
  onDragLeave,
  onDrop,
  onEditCourse,
  onDeleteCourse,
  onDragStart
}: ScheduleGridProps) {
  const filteredCourses = courses.filter(c => c.weeks.includes(currentWeek));

  const getCourseAtCell = (weekday: number, section: number): EditableCourse | undefined => {
    return filteredCourses.find(c => c.weekday === weekday && c.sections.includes(section));
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto momentum-scroll" id="schedule-table-container" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      <div className="min-w-[700px] md:min-w-[800px]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px bg-surface-container-high">
          {/* Header row */}
          <div className="bg-surface-container-low p-2 text-center text-xs font-bold text-outline sticky left-0 top-0 z-20">
            节次
          </div>
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="bg-surface-container-low p-2 text-center text-sm font-bold text-on-surface sticky top-0 z-10"
            >
              {day}
            </div>
          ))}

          {/* Time slots */}
          {SECTION_TIMES.map((sectionInfo, sectionIndex) => (
            <React.Fragment key={sectionInfo.section}>
              <div className="bg-surface-container-lowest p-2 text-center sticky left-0 z-10">
                <div className="text-xs font-bold text-on-surface">第{sectionInfo.section}节</div>
                <div className="text-[10px] text-outline">{sectionInfo.time}</div>
              </div>
              {WEEKDAYS.map((_, dayIndex) => {
                const weekday = dayIndex + 1;
                const section = sectionIndex + 1;
                const course = getCourseAtCell(weekday, section);
                const isDropTarget = dragOverCell?.weekday === weekday && dragOverCell?.section === section;

                return (
                  <div
                    key={`${weekday}-${section}`}
                    onDragOver={(e) => onDragOver(e, weekday, section)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, weekday, section)}
                    className={cn(
                      "bg-surface-container-lowest min-h-[60px] relative transition-colors",
                      isDropTarget && "bg-primary/10 ring-2 ring-primary ring-inset",
                      sectionIndex % 2 === 0 && "bg-surface-container-low/30"
                    )}
                  >
                    <AnimatePresence>
                      {course && (
                        <CourseBlock
                          course={course}
                          sectionIndex={sectionIndex}
                          courseIndex={courses.indexOf(course)}
                          onEdit={onEditCourse}
                          onDelete={onDeleteCourse}
                          onDragStart={onDragStart}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
