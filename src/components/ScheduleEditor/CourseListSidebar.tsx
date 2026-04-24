import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, List } from 'lucide-react';
import { EditableCourse } from '@/types';
import CourseListItem from './CourseListItem';

interface CourseListSidebarProps {
  courses: EditableCourse[];
  currentWeek: number;
  isOpen: boolean;
  onClose: () => void;
  onEditCourse: (course: EditableCourse) => void;
  onDeleteCourse: (courseId: string) => void;
}

export default function CourseListSidebar({
  courses,
  currentWeek,
  isOpen,
  onClose,
  onEditCourse,
  onDeleteCourse
}: CourseListSidebarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 450 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 450 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="absolute right-0 top-0 w-[450px] h-full max-h-[calc(100vh-320px)] bg-surface-container-lowest border-l border-surface-container-high shadow-2xl z-30"
        >
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-surface-container-high flex items-center justify-between flex-shrink-0">
              <h4 className="font-bold text-on-surface font-headline text-lg">课程列表</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-on-surface-variant">共 {courses.length} 门</span>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-surface-container-low rounded-lg transition-colors"
                >
                  <X size={16} className="text-on-surface-variant" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <AnimatePresence>
                {courses.length === 0 ? (
                  <div className="text-center py-8 text-on-surface-variant">
                    <List className="mx-auto mb-2 text-outline" size={32} />
                    <p className="text-sm">暂无课程</p>
                    <p className="text-xs mt-1">点击"添加课程"开始</p>
                  </div>
                ) : (
                  courses.map((course, index) => (
                    <CourseListItem
                      key={course.id}
                      course={course}
                      currentWeek={currentWeek}
                      courseIndex={index}
                      onEdit={onEditCourse}
                      onDelete={onDeleteCourse}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
