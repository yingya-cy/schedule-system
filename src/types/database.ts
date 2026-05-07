export interface Department {
  id: number;
  name: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface Schedule {
  id: number;
  name: string;
  department: string;
  filename: string | null;
  file_data?: Buffer | null;
  file_type?: string | null;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
  courses?: Course[];
}

export interface Course {
  id: number;
  schedule_id: number;
  course_name: string;
  weekday: number;
  sections: number[];
  weeks: number[];
  teacher: string | null;
  location: string | null;
  remark: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateScheduleDto {
  name: string;
  department: string;
  filename?: string;
  file_data?: string;
  file_type?: string;
  storage_type?: string;
  file_path?: string | null;
  file_size?: number;
  file_hash?: string | null;
  created_by?: string | null;
  courses: CreateCourseDto[];
}

export interface CreateCourseDto {
  course_name: string;
  weekday: number;
  sections: number[];
  weeks: number[];
  teacher?: string;
  location?: string;
  remark?: string;
}

export interface UpdateScheduleDto {
  name?: string;
  department?: string;
  filename?: string;
}

export interface UpdateCourseDto {
  course_name?: string;
  weekday?: number;
  sections?: number[];
  weeks?: number[];
  teacher?: string;
  location?: string;
  remark?: string;
}

export interface FreeTimeQuery {
  week?: number;
  day?: number;
  section?: number;
  department?: string;
  name?: string;
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

export interface PersonSchedule {
  schedule: Schedule;
  all_courses: Course[];
}
