import { Department, ScheduleData, CourseData, FreeTimeResult } from '@/types';

export const api = {
  async getDepartments(): Promise<Department[]> {
    const response = await fetch('/api/departments');
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.error);
  },

  async getSchedules(filters?: { department?: string; name?: string }): Promise<ScheduleData[]> {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department);
    if (filters?.name) params.append('name', filters.name);
    
    const response = await fetch(`/api/schedules?${params.toString()}`);
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.error);
  },

  async getSchedule(id: number): Promise<ScheduleData> {
    const response = await fetch(`/api/schedules/${id}`);
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.error);
  },

  async createSchedule(data: {
    name: string;
    department: string;
    filename?: string;
    file_data?: string;
    file_type?: string;
    courses: {
      course_name: string;
      weekday: number;
      sections: number[];
      weeks: number[];
      teacher?: string;
      location?: string;
      remark?: string;
    }[];
  }): Promise<ScheduleData> {
    const response = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.error);
  },

  getScheduleFileUrl(id: number, download: boolean = false): string {
    return `/api/schedules/${id}/file${download ? '?download=true' : ''}`;
  },

  async updateSchedule(id: number, data: { name?: string; department?: string }): Promise<ScheduleData> {
    const response = await fetch(`/api/schedules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.error);
  },

  async deleteSchedule(id: number): Promise<boolean> {
    const response = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    const result = await response.json();
    return result.success;
  },

  async createCourse(scheduleId: number, data: {
    course_name: string;
    weekday: number;
    sections: number[];
    weeks: number[];
    teacher?: string;
    location?: string;
    remark?: string;
  }): Promise<CourseData> {
    const response = await fetch(`/api/schedules/${scheduleId}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.error);
  },

  async updateCourse(id: number, data: {
    course_name?: string;
    weekday?: number;
    sections?: number[];
    weeks?: number[];
    teacher?: string;
    location?: string;
    remark?: string;
  }): Promise<CourseData> {
    const response = await fetch(`/api/courses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.error);
  },

  async deleteCourse(id: number): Promise<boolean> {
    const response = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
    const result = await response.json();
    return result.success;
  },

  async queryFreeTime(params: {
    week?: number;
    day?: number;
    section?: number;
    department?: string;
    name?: string;
  }): Promise<FreeTimeResult[]> {
    const searchParams = new URLSearchParams();
    if (params.week) searchParams.append('week', params.week.toString());
    if (params.day) searchParams.append('day', params.day.toString());
    if (params.section) searchParams.append('section', params.section.toString());
    if (params.department) searchParams.append('department', params.department);
    if (params.name) searchParams.append('name', params.name);

    const response = await fetch(`/api/query/free-time?${searchParams.toString()}`);
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.error);
  },

  async getAllFreeTimeData(): Promise<{
    total_schedules: number;
    free_time_matrix: Record<string, Record<string, Record<string, string[]>>>;
  }> {
    const response = await fetch('/api/query/all-free-time');
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.error);
  },
};
