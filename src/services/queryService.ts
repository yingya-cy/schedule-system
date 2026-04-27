import pool from '../config/database';
import { FreeTimeQuery, FreeTimeResult, PersonSchedule, Schedule, Course } from '../types/database';

interface ScheduleRow {
  id: number;
  name: string;
  department: string;
}

interface CourseRow {
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

interface FreePerson {
  schedule_id: number;
  name: string;
  department: string;
}

export class QueryService {
  /**
   * 查询空闲时间
   * 优化：一次性加载所有相关 schedules 和 courses，避免 N+1 查询
   */
  async queryFreeTime(query: FreeTimeQuery): Promise<FreeTimeResult[]> {
    // 构建基础查询条件
    let schedulesQuery = 'SELECT id, name, department FROM schedules';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (query.department) {
      conditions.push('department = ?');
      params.push(query.department);
    }

    if (query.name) {
      conditions.push('name LIKE ?');
      params.push(`%${query.name.replace(/[%_]/g, '\\$&')}%`);
    }

    if (conditions.length > 0) {
      schedulesQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // 1. 一次性获取所有 schedules
    const [scheduleRows] = await pool.execute(schedulesQuery, params);
    const schedules = scheduleRows as ScheduleRow[];

    if (schedules.length === 0) {
      return [];
    }

    // 2. 一次性获取所有相关 courses（使用 schedule_id IN (...)）
    const scheduleIds = schedules.map(s => s.id);
    const placeholders = scheduleIds.map(() => '?').join(', ');
    const [courseRows] = await pool.execute(
      `SELECT schedule_id, weekday, sections, weeks FROM courses WHERE schedule_id IN (${placeholders})`,
      scheduleIds
    );
    const allCourses = courseRows as CourseRow[];

    // 3. 按 schedule_id 建索引，方便后续查询
    const coursesByScheduleId = new Map<number, CourseRow[]>();
    for (const course of allCourses) {
      const list = coursesByScheduleId.get(course.schedule_id) || [];
      list.push(course);
      coursesByScheduleId.set(course.schedule_id, list);
    }

    // 4. 确定查询范围
    const weeks = query.week ? [query.week] : Array.from({ length: 18 }, (_, i) => i + 1);
    const days = query.day ? [query.day] : Array.from({ length: 7 }, (_, i) => i + 1);
    const sections = query.section ? [query.section] : Array.from({ length: 11 }, (_, i) => i + 1);

    // 5. 内存中计算空闲时间（无额外数据库查询）
    const results: FreeTimeResult[] = [];

    for (const week of weeks) {
      for (const day of days) {
        for (const section of sections) {
          const freePeople: FreePerson[] = [];

          for (const schedule of schedules) {
            const courses = coursesByScheduleId.get(schedule.id) || [];
            const isFree = !courses.some(course =>
              course.weekday === day &&
              (course.sections as number[]).includes(section) &&
              (course.weeks as number[]).includes(week)
            );

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

  /**
   * 获取所有空闲时间矩阵
   * 优化：一次性加载所有数据，内存中计算
   */
  async getAllFreeTimeData(): Promise<{
    total_schedules: number;
    free_time_matrix: Record<string, Record<string, Record<string, string[]>>>;
  }> {
    // 1. 一次性获取所有 schedules 和 courses（JOIN 查询）
    const [rows] = await pool.execute(`
      SELECT s.id as schedule_id, s.name, c.weekday, c.sections, c.weeks
      FROM schedules s
      LEFT JOIN courses c ON s.id = c.schedule_id
    `);

    // 2. 按 schedule 分组
    const scheduleMap = new Map<string, { weekday: number; sections: number[]; weeks: number[] }[]>();
    for (const row of rows as { schedule_id: number; name: string; weekday: number; sections: number[]; weeks: number[] }[]) {
      const name = row.name;
      if (!scheduleMap.has(name)) {
        scheduleMap.set(name, []);
      }
      if (row.weekday != null) {
        scheduleMap.get(name)!.push({
          weekday: row.weekday,
          sections: row.sections,
          weeks: row.weeks
        });
      }
    }

    // 3. 构建空闲时间矩阵
    const freeTimeMatrix: Record<string, Record<string, Record<string, string[]>>> = {};
    const scheduleNames = Array.from(scheduleMap.keys());

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

          // 检查每个人的空闲时间
          for (const name of scheduleNames) {
            const courses = scheduleMap.get(name) || [];
            const isFree = !courses.some(course =>
              course.weekday === day &&
              course.sections.includes(section) &&
              course.weeks.includes(week)
            );

            if (isFree) {
              freeTimeMatrix[weekKey][dayKey][sectionKey].push(name);
            }
          }
        }
      }
    }

    return {
      total_schedules: scheduleNames.length,
      free_time_matrix: freeTimeMatrix
    };
  }
}

export default new QueryService();
