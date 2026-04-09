import pool from '../config/database';
import { FreeTimeQuery, FreeTimeResult, PersonSchedule, Schedule, Course } from '../types/database';

export class QueryService {
  async queryFreeTime(query: FreeTimeQuery): Promise<FreeTimeResult[]> {
    const results: FreeTimeResult[] = [];
    
    let schedulesQuery = 'SELECT id, name, department FROM schedules';
    const params: any[] = [];
    const conditions: string[] = [];

    if (query.department) {
      conditions.push('department = ?');
      params.push(query.department);
    }

    if (query.name) {
      conditions.push('name LIKE ?');
      params.push(`%${query.name}%`);
    }

    if (conditions.length > 0) {
      schedulesQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const [scheduleRows] = await pool.execute(schedulesQuery, params);
    const schedules = scheduleRows as Array<{ id: number; name: string; department: string }>;

    const weeks = query.week ? [query.week] : Array.from({ length: 18 }, (_, i) => i + 1);
    const days = query.day ? [query.day] : Array.from({ length: 7 }, (_, i) => i + 1);
    const sections = query.section ? [query.section] : Array.from({ length: 11 }, (_, i) => i + 1);

    for (const week of weeks) {
      for (const day of days) {
        for (const section of sections) {
          const freePeople: Array<{ schedule_id: number; name: string; department: string }> = [];

          for (const schedule of schedules) {
            const isFree = await this.checkIfPersonFree(schedule.id, week, day, section);
            if (isFree) {
              freePeople.push({
                schedule_id: schedule.id,
                name: schedule.name,
                department: schedule.department
              });
            }
          }

          results.push({
            week,
            day,
            section,
            free_people: freePeople,
            total_count: freePeople.length
          });
        }
      }
    }

    return results;
  }

  private async checkIfPersonFree(scheduleId: number, week: number, day: number, section: number): Promise<boolean> {
    const [rows] = await pool.execute(
      'SELECT * FROM courses WHERE schedule_id = ? AND weekday = ?',
      [scheduleId, day]
    );

    const courses = rows as Course[];

    for (const course of courses) {
      const sections = course.sections as number[];
      const weeks = course.weeks as number[];

      if (sections.includes(section) && weeks.includes(week)) {
        return false;
      }
    }

    return true;
  }

  async getPersonSchedule(name: string): Promise<PersonSchedule | null> {
    const [scheduleRows] = await pool.execute(
      'SELECT * FROM schedules WHERE name = ?',
      [name]
    );

    const schedules = scheduleRows as Schedule[];
    if (schedules.length === 0) return null;

    const schedule = schedules[0];

    const [courseRows] = await pool.execute(
      'SELECT * FROM courses WHERE schedule_id = ? ORDER BY weekday ASC, sections ASC',
      [schedule.id]
    );

    const allCourses = courseRows as Course[];

    return {
      schedule,
      all_courses: allCourses
    };
  }

  async getDepartmentStats(department: string): Promise<{
    department: string;
    total_people: number;
    schedules: Schedule[];
  }> {
    const [scheduleRows] = await pool.execute(
      'SELECT * FROM schedules WHERE department = ? ORDER BY name ASC',
      [department]
    );

    const schedules = scheduleRows as Schedule[];

    return {
      department,
      total_people: schedules.length,
      schedules
    };
  }

  async getAllFreeTimeData(): Promise<{
    total_schedules: number;
    free_time_matrix: Record<string, Record<string, Record<string, string[]>>>;
  }> {
    const [scheduleRows] = await pool.execute('SELECT id, name, department FROM schedules');
    const schedules = scheduleRows as Array<{ id: number; name: string; department: string }>;

    const freeTimeMatrix: Record<string, Record<string, Record<string, string[]>>> = {};

    for (const schedule of schedules) {
      const [courseRows] = await pool.execute(
        'SELECT * FROM courses WHERE schedule_id = ?',
        [schedule.id]
      );

      const courses = courseRows as Course[];

      for (let week = 1; week <= 18; week++) {
        for (let day = 1; day <= 7; day++) {
          for (let section = 1; section <= 11; section++) {
            const weekKey = week.toString();
            const dayKey = day.toString();
            const sectionKey = section.toString();

            if (!freeTimeMatrix[weekKey]) {
              freeTimeMatrix[weekKey] = {};
            }
            if (!freeTimeMatrix[weekKey][dayKey]) {
              freeTimeMatrix[weekKey][dayKey] = {};
            }
            if (!freeTimeMatrix[weekKey][dayKey][sectionKey]) {
              freeTimeMatrix[weekKey][dayKey][sectionKey] = [];
            }

            const isFree = !courses.some(course => {
              const sections = course.sections as number[];
              const weeks = course.weeks as number[];
              return sections.includes(section) && weeks.includes(week) && course.weekday === day;
            });

            if (isFree) {
              freeTimeMatrix[weekKey][dayKey][sectionKey].push(schedule.name);
            }
          }
        }
      }
    }

    return {
      total_schedules: schedules.length,
      free_time_matrix: freeTimeMatrix
    };
  }
}

export default new QueryService();
