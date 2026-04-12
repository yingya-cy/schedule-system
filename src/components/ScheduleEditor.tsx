import React, { useState, useCallback, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Target,
  List,
  MapPin,
  User,
  Calendar,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { 
  EditableCourse, 
  WEEKDAYS, 
  SECTION_TIMES, 
  COURSE_COLORS
} from '@/types';

interface ScheduleEditorProps {
  courses: EditableCourse[];
  onCoursesChange: (courses: EditableCourse[]) => void;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

interface WeekRange {
  id: string;
  start: number | null;
  end: number | null;
  type: 'all' | 'odd' | 'even';
}

const getCourseColor = (index: number) => COURSE_COLORS[index % COURSE_COLORS.length];
const CURRENT_WEEK_KEY = 'schedule_editor_current_week';

const formatWeeksDisplay = (weeks: number[]): string => {
  if (!weeks || weeks.length === 0) return '未设置';
  
  const sorted = [...weeks].sort((a, b) => a - b);
  const ranges: { start: number; end: number; isOdd?: boolean; isEven?: boolean }[] = [];
  
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    let end = start;
    
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) {
      i++;
      end = sorted[i];
    }
    
    const rangeWeeks = sorted.filter(w => w >= start && w <= end);
    const isOdd = rangeWeeks.every(w => w % 2 === 1) && rangeWeeks.length > 1;
    const isEven = rangeWeeks.every(w => w % 2 === 0) && rangeWeeks.length > 1;
    
    ranges.push({ start, end, isOdd, isEven });
    i++;
  }
  
  return ranges.map(r => {
    let str = r.start === r.end ? `${r.start}周` : `${r.start}-${r.end}周`;
    if (r.isOdd) str += '(单)';
    if (r.isEven) str += '(双)';
    return str;
  }).join(',');
};

const parseWeeksFromRanges = (ranges: WeekRange[]): number[] => {
  const weeks = new Set<number>();
  
  for (const range of ranges) {
    if (range.start === null || range.end === null) continue;
    
    const start = range.start;
    const end = range.end;
    
    if (range.type === 'odd') {
      for (let w = start; w <= end; w += 2) {
        if (w % 2 === 1) weeks.add(w);
      }
    } else if (range.type === 'even') {
      for (let w = start; w <= end; w += 2) {
        if (w % 2 === 0) weeks.add(w);
      }
    } else {
      for (let w = start; w <= end; w++) {
        weeks.add(w);
      }
    }
  }
  
  return Array.from(weeks).sort((a, b) => a - b);
};

const weeksToRanges = (weeks: number[]): WeekRange[] => {
  if (!weeks || weeks.length === 0) return [];
  
  const sorted = [...weeks].sort((a, b) => a - b);
  const ranges: WeekRange[] = [];
  
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i];
    let end = start;
    
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) {
      i++;
      end = sorted[i];
    }
    
    const rangeWeeks = sorted.filter(w => w >= start && w <= end);
    const isOdd = rangeWeeks.every(w => w % 2 === 1) && rangeWeeks.length > 1;
    const isEven = rangeWeeks.every(w => w % 2 === 0) && rangeWeeks.length > 1;
    
    ranges.push({
      id: `range-${Date.now()}-${Math.random()}`,
      start,
      end,
      type: isOdd ? 'odd' : isEven ? 'even' : 'all'
    });
    
    i++;
  }
  
  return ranges;
};

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

  const renderCourseBlock = (course: EditableCourse, sectionIndex: number) => {
    const isFirstSection = course.sections[0] === sectionIndex + 1;
    if (!isFirstSection) return null;

    const rowSpan = course.sections.length;
    const colorIndex = courses.indexOf(course);
    const bgColor = getCourseColor(colorIndex);
    const cellHeight = 60;
    const blockHeight = cellHeight * rowSpan + (rowSpan - 1) * 1;

    return (
      <div
        key={course.id}
        draggable
        onDragStart={(e) => handleDragStart(e, course)}
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
              onClick={(e) => { e.stopPropagation(); handleEditCourse(course); }}
              className="p-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
            >
              <Edit3 size={10} className="text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id); }}
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
  };

  const renderCourseListItem = (course: EditableCourse, index: number) => {
    const bgColor = getCourseColor(index);
    const isInCurrentWeek = course.weeks.includes(currentWeek);
    
    return (
      <motion.div
        key={course.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className={cn(
          "p-3 rounded-xl border transition-all cursor-pointer group",
          isInCurrentWeek 
            ? "bg-surface-container-low border-surface-container-high hover:border-primary/30" 
            : "bg-surface-container-lowest/50 border-surface-container-high/50 opacity-60"
        )}
        onClick={() => handleEditCourse(course)}
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
                  onClick={(e) => { e.stopPropagation(); handleEditCourse(course); }}
                  className="p-1 hover:bg-surface-container rounded transition-colors"
                >
                  <Edit3 size={12} className="text-on-surface-variant" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id); }}
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
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-lg border border-surface-container-high overflow-hidden">
      <div className="p-4 border-b border-surface-container-high flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-on-surface font-headline">课表编辑</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={cn(
                "px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-sm font-semibold",
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
              className="px-4 py-2 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:scale-[0.98] transition-all flex items-center gap-2"
            >
              <Plus size={16} />
              添加课程
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-surface-container-low text-on-surface-variant text-sm font-semibold rounded-lg hover:bg-surface-container transition-all"
              >
                取消
              </button>
            )}
            {onSave && (
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? '保存中...' : '保存课表'}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 p-3 bg-surface-container-low rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-on-surface">当前周次:</span>
            <button
              onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
              disabled={currentWeek <= 1}
              className="p-1.5 bg-surface-container rounded-lg hover:bg-surface-container-high disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="relative">
              <span className="text-lg font-bold text-primary px-2">第{currentWeek}周</span>
              {actualCurrentWeek === currentWeek && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <Check size={10} className="text-white" />
                </div>
              )}
            </div>
            <button
              onClick={() => setCurrentWeek(Math.min(18, currentWeek + 1))}
              disabled={currentWeek >= 18}
              className="p-1.5 bg-surface-container rounded-lg hover:bg-surface-container-high disabled:opacity-30 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex-1 flex items-center gap-1">
            {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
              <button
                key={week}
                onClick={() => setCurrentWeek(week)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleSetCurrentWeek(week);
                }}
                className={cn(
                  "w-6 h-6 text-xs font-medium rounded transition-all relative",
                  currentWeek === week
                    ? "bg-primary text-on-primary"
                    : actualCurrentWeek === week
                      ? "bg-green-500 text-white"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                {week}
              </button>
            ))}
          </div>

          {actualCurrentWeek && (
            <button
              onClick={jumpToCurrentWeek}
              className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-lg hover:bg-primary/20 transition-all flex items-center gap-1"
            >
              <Target size={12} />
              跳转当前周
            </button>
          )}
        </div>

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

      <div className="flex relative">
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]" id="schedule-table-container">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px bg-surface-container-high">
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
                        onDragOver={(e) => handleDragOver(e, weekday, section)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, weekday, section)}
                        className={cn(
                          "bg-surface-container-lowest min-h-[60px] relative transition-colors",
                          isDropTarget && "bg-primary/10 ring-2 ring-primary ring-inset",
                          sectionIndex % 2 === 0 && "bg-surface-container-low/30"
                        )}
                      >
                        <AnimatePresence>
                          {course && renderCourseBlock(course, sectionIndex)}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showSidebar && (
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
                      onClick={() => setShowSidebar(false)}
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
                      courses.map((course, index) => renderCourseListItem(course, index))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

interface CourseEditModalProps {
  course: EditableCourse;
  onSave: (course: EditableCourse) => void;
  onClose: () => void;
  isNew?: boolean;
}

function CourseEditModal({ course, onSave, onClose, isNew = false }: CourseEditModalProps) {
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

  const parseSectionInput = (input: string): number[] => {
    const match = input.match(/(\d+)\s*[-~]\s*(\d+)/);
    if (match) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    const singleMatch = input.match(/(\d+)/);
    if (singleMatch) {
      return [parseInt(singleMatch[1])];
    }
    return [];
  };

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

  const updateWeekRange = (id: string, field: keyof WeekRange, value: any) => {
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
          <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-lg transition-colors">
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
              className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">星期</label>
              <select
                value={editingCourse.weekday}
                onChange={(e) => setEditingCourse({ ...editingCourse, weekday: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
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
                className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
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
                      "px-2 py-1 text-xs font-medium rounded transition-colors",
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
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
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
                      className="w-16 px-2 py-1.5 text-sm border border-surface-container-high rounded focus:ring-2 focus:ring-primary outline-none text-center"
                    />
                    <span className="text-on-surface-variant">—</span>
                    <input
                      type="number"
                      min={1}
                      max={18}
                      value={range.end ?? ''}
                      onChange={(e) => updateWeekRange(range.id, 'end', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="结束"
                      className="w-16 px-2 py-1.5 text-sm border border-surface-container-high rounded focus:ring-2 focus:ring-primary outline-none text-center"
                    />
                    <span className="text-on-surface-variant">周</span>
                    <select
                      value={range.type}
                      onChange={(e) => updateWeekRange(range.id, 'type', e.target.value)}
                      className="px-2 py-1.5 text-sm border border-surface-container-high rounded focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="all">无</option>
                      <option value="odd">单周</option>
                      <option value="even">双周</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeWeekRange(range.id)}
                      className="p-1 text-on-surface-variant hover:text-red-500 transition-colors"
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">教师</label>
              <input
                type="text"
                value={editingCourse.teacher}
                onChange={(e) => setEditingCourse({ ...editingCourse, teacher: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">地点</label>
              <input
                type="text"
                value={editingCourse.location}
                onChange={(e) => setEditingCourse({ ...editingCourse, location: e.target.value })}
                className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-1">备注</label>
            <textarea
              value={editingCourse.remark}
              onChange={(e) => setEditingCourse({ ...editingCourse, remark: e.target.value })}
              className="w-full px-4 py-2.5 border border-surface-container-high rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="p-6 border-t border-surface-container-high flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-low text-on-surface-variant font-medium rounded-lg hover:bg-surface-container transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!editingCourse.course_name}
            className="px-4 py-2 bg-primary text-on-primary font-semibold rounded-lg hover:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Check size={16} />
            {isNew ? '添加课程' : '保存修改'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
