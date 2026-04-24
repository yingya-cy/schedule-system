import { EditableCourse } from '@/types';

export interface WeekRange {
  id: string;
  start: number | null;
  end: number | null;
  type: 'all' | 'odd' | 'even';
}

export interface CourseEditModalProps {
  course: EditableCourse;
  onSave: (course: EditableCourse) => void;
  onClose: () => void;
  isNew?: boolean;
}

export const CURRENT_WEEK_KEY = 'schedule_editor_current_week';

export const CELL_HEIGHT = 60;
