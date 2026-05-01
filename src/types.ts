// Route paths
export type RoutePath = '/dashboard' | '/files' | '/courses' | '/contacts' | '/schedule' | '/chat' | '/scoring' | '/login' | '/users' | '/file-center';

export const ROUTE_LABELS: Record<RoutePath, string> = {
  '/dashboard': '仪表盘',
  '/files': '课表中心',
  '/courses': '课程目录',
  '/contacts': '联系人',
  '/schedule': '排班管理',
  '/chat': '群聊',
  '/scoring': '比赛评分',
  '/login': '登录',
  '/users': '用户管理',
  '/file-center': '文件中心',
};

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  statusText?: string;
  description?: string;
  tags?: string[];
}

export interface CourseDisplay {
  id: string;
  title: string;
  description: string;
  instructor: string;
  location: string;
  time: string;
  category: string;
  icon: string;
  color: string;
  image?: string;
}

export interface FileItem {
  id: string;
  name: string;
  size: string;
  updatedAt: string;
  updatedBy: string;
  type: 'excel' | 'pdf' | 'csv' | 'folder';
}

export type PdfType = 'vertical' | 'horizontal';
export type ScheduleType = 'standard' | 'dense_wide';

export interface UnifiedCourse {
  courseName: string;
  time: string;
  weeks: string;
  weeksList?: number[];
  teacher?: string;
  classroom?: string;
  remark?: string;
}

export interface ProcessResult {
  filename: string;
  success: boolean;
  courses?: UnifiedCourse[];
  error?: string;
  rawJsonText?: string;
}

export interface CourseRecord {
  id: string;
  courseName: string;
  dayOfWeek: string;
  sessionRaw: string;
  weeks: number[];
  teacher: string;
  location: string;
}

export interface BackendCourseData {
  course_name?: string;
  course?: string;
  name?: string;
  time?: string;
  weeks?: string;
  week?: string;
  weeks_list?: number[];
  teacher?: string;
  classroom?: string;
  location?: string;
  remark?: string;
  weekday?: number;
  day?: number;
  section?: string;
  period?: string;
}

export interface Department {
  id: number;
  name: string;
  sort_order: number;
}

export interface ScheduleData {
  id: number;
  name: string;
  department: string;
  filename: string | null;
  created_at: string;
  updated_at: string;
  courses?: CourseData[];
}

export interface CourseData {
  id: number;
  schedule_id: number;
  course_name: string;
  weekday: number;
  sections: number[];
  weeks: number[];
  teacher: string | null;
  location: string | null;
  remark: string | null;
}

export interface EditableCourse {
  id: string;
  course_name: string;
  weekday: number;
  sections: number[];
  weeks: number[];
  teacher: string;
  location: string;
  remark: string;
  isNew?: boolean;
  isModified?: boolean;
}

export interface FreeTimeResult {
  week: number;
  day: number;
  section: number;
  free_people: Array<{
    schedule_id: number;
    name: string;
    department: string;
  }>;
  total_count: number;
}

export interface TimeSlot {
  label: string;
  sections: number[];
  period: string;
}

export const TIME_SLOTS: TimeSlot[] = [
  { label: '第1-2节', sections: [1, 2], period: '上午' },
  { label: '第3-4节', sections: [3, 4], period: '上午' },
  { label: '第5-6节', sections: [5, 6], period: '下午' },
  { label: '第7-8节', sections: [7, 8], period: '下午' },
  { label: '第9-11节', sections: [9, 10, 11], period: '晚上' },
];

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export const SECTION_TIMES = [
  { section: 1, time: '08:00-08:45' },
  { section: 2, time: '08:55-09:40' },
  { section: 3, time: '10:00-10:45' },
  { section: 4, time: '10:55-11:40' },
  { section: 5, time: '14:00-14:45' },
  { section: 6, time: '14:55-15:40' },
  { section: 7, time: '16:00-16:45' },
  { section: 8, time: '16:55-17:40' },
  { section: 9, time: '19:00-19:45' },
  { section: 10, time: '19:55-20:40' },
  { section: 11, time: '20:50-21:35' },
];

export const COURSE_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

// 学期周数
export const WEEK_COUNT = 20;
