import React, { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  GripVertical,
  List,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { EditableCourse } from '@/types';
import WeekSelector from '../WeekSelector';
import ScheduleGrid from './ScheduleGrid';
import CourseListSidebar from './CourseListSidebar';
import CourseEditModal from './CourseEditModal';
import { CURRENT_WEEK_KEY, CELL_HEIGHT } from './constants';
import { parseSectionInput } from './utils';

interface ScheduleEditorProps {
  courses: EditableCourse[];
  onCoursesChange: (courses: EditableCourse[]) => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export default function ScheduleEditor({
  courses,
  onCoursesChange,
  onSave,
  onCancel,
  isSaving = false
}: ScheduleEditorProps) {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [actualCurrentWeek, setActualCurrentWeek] = useState<number | null>(null);
  const [editingCourse, setEditingCourse] = useState<EditableCourse | null>(null);
  const [draggedCourse, setDraggedCourse] = useState<EditableCourse | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ weekday: number; section: number } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [newCourse, setNewCourse] = useState<Partial<EditableCourse>>({
    course_name: '',
    weekday: 1,
    sections: [],
    weeks: [],
    teacher: '',
    location: '',
    remark: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem(CURRENT_WEEK_KEY);
    if (saved) {
      setActualCurrentWeek(parseInt(saved));
    }
  }, []);

  const filteredCourses = courses.filter(c => c.weeks.includes(currentWeek));

  const getCourseAtCell = useCallback((weekday: number, section: number): EditableCourse | undefined => {
    return filteredCourses.find(c => c.weekday === weekday && c.sections.includes(section));
  }, [filteredCourses]);

  const handleSetCurrentWeek = (week: number) => {
    setActualCurrentWeek(week);
    localStorage.setItem(CURRENT_WEEK_KEY, String(week));
  };

  const jumpToCurrentWeek = () => {
    if (actualCurrentWeek) {
      setCurrentWeek(actualCurrentWeek);
    }
  };

  const handleDragStart = (e: React.DragEvent, course: EditableCourse) => {
    setDraggedCourse(course);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, weekday: number, section: number) => {
    e.preventDefault();
    setDragOverCell({ weekday, section });
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, weekday: number, section: number) => {
    e.preventDefault();
    if (!draggedCourse) return;

    const existingCourse = getCourseAtCell(weekday, section);
    if (existingCourse && existingCourse.id !== draggedCourse.id) {
      setDragOverCell(null);
      setDraggedCourse(null);
      return;
    }

    const sectionCount = draggedCourse.sections.length;
    const newSections = Array.from({ length: sectionCount }, (_, i) => section + i);

    const updatedCourses = courses.map(c =>
      c.id === draggedCourse.id
        ? { ...c, weekday, sections: newSections, isModified: true }
        : c
    );
    onCoursesChange(updatedCourses);

    setDraggedCourse(null);
    setDragOverCell(null);
  };

  const handleEditCourse = (course: EditableCourse) => {
    setEditingCourse({ ...course });
  };

  const handleSaveEdit = () => {
    if (!editingCourse) return;

    const updatedCourses = courses.map(c =>
      c.id === editingCourse.id
        ? { ...editingCourse, isModified: true }
        : c
    );
    onCoursesChange(updatedCourses);
    setEditingCourse(null);
  };

  const handleDeleteCourse = (courseId: string) => {
    const updatedCourses = courses.filter(c => c.id !== courseId);
    onCoursesChange(updatedCourses);
  };

  const handleAddCourse = () => {
    if (!newCourse.course_name || !newCourse.weekday || !newCourse.sections?.length) {
      return;
    }

    const course: EditableCourse = {
      id: `new-${Date.now()}`,
      course_name: newCourse.course_name,
      weekday: newCourse.weekday,
      sections: newCourse.sections,
      weeks: newCourse.weeks && newCourse.weeks.length > 0 ? newCourse.weeks : [],
      teacher: newCourse.teacher || '',
      location: newCourse.location || '',
      remark: newCourse.remark || '',
      isNew: true
    };

    onCoursesChange([...courses, course]);
    setShowAddModal(false);
    setNewCourse({
      course_name: '',
      weekday: 1,
      sections: [],
      weeks: [],
      teacher: '',
      location: '',
      remark: ''
    });
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-lg border border-surface-container-high overflow-hidden p-4 lg:p-6">
      {/* Header */}
      <div className="border-b border-surface-container-high flex flex-col gap-4 pb-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h3 className="font-bold text-lg text-on-surface font-headline">课表编辑</h3>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={cn(
                "px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm font-semibold touch-target",
                showSidebar
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              )}
            >
              <List size={16} />
              {showSidebar ? '隐藏列表' : '课程列表'}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:scale-[0.98] transition-all flex items-center gap-2 touch-target"
            >
              <Plus size={16} />
              添加课程
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-surface-container-low text-on-surface-variant text-sm font-semibold rounded-lg hover:bg-surface-container transition-all touch-target"
              >
                取消
              </button>
            )}
            {onSave && (
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 touch-target"
              >
                {isSaving ? '保存中...' : '保存课表'}
              </button>
            )}
          </div>
        </div>

        {/* Week Selector */}
        <WeekSelector
          currentWeek={currentWeek}
          actualCurrentWeek={actualCurrentWeek}
          onWeekChange={setCurrentWeek}
          onSetActualWeek={handleSetCurrentWeek}
        />

        {/* Tips */}
        <div className="flex items-center gap-4 text-xs text-on-surface-variant">
          <span>点击选择周次</span>
          <span>右键设为当前周</span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            当前周
          </span>
          <span>本周共 {filteredCourses.length} 门课程</span>
        </div>
      </div>

      {/* Grid + Sidebar */}
      <div className="flex relative">
        <ScheduleGrid
          courses={courses}
          currentWeek={currentWeek}
          dragOverCell={dragOverCell}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onEditCourse={handleEditCourse}
          onDeleteCourse={handleDeleteCourse}
          onDragStart={handleDragStart}
        />

        <CourseListSidebar
          courses={courses}
          currentWeek={currentWeek}
          isOpen={showSidebar}
          onClose={() => setShowSidebar(false)}
          onEditCourse={handleEditCourse}
          onDeleteCourse={handleDeleteCourse}
        />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-surface-container-high bg-surface-container-low/30">
        <div className="flex items-center gap-4 text-xs text-outline">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded ring-2 ring-green-400"></div>
            <span>新增课程</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded ring-2 ring-yellow-400"></div>
            <span>已修改</span>
          </div>
          <div className="flex items-center gap-1">
            <GripVertical size={12} />
            <span>拖拽课程调整时间</span>
          </div>
          <div className="flex items-center gap-1">
            <List size={12} />
            <span>侧栏查看课程列表</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {editingCourse && (
          <CourseEditModal
            course={editingCourse}
            onSave={(updated) => {
              const updatedCourses = courses.map(c =>
                c.id === updated.id ? { ...updated, isModified: true } : c
              );
              onCoursesChange(updatedCourses);
              setEditingCourse(null);
            }}
            onClose={() => setEditingCourse(null)}
          />
        )}

        {showAddModal && (
          <CourseEditModal
            course={{
              id: `new-${Date.now()}`,
              course_name: '',
              weekday: 1,
              sections: [],
              weeks: [],
              teacher: '',
              location: '',
              remark: '',
              isNew: true
            }}
            onSave={(course) => {
              onCoursesChange([...courses, { ...course, isNew: true }]);
              setShowAddModal(false);
            }}
            onClose={() => setShowAddModal(false)}
            isNew
          />
        )}
      </AnimatePresence>
    </div>
  );
}
