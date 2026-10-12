import pool from '../config/database';
import { FreeTimeQuery, FreeTimeResult, PersonSchedule, Schedule, Course } from '../types/database';
import { RowDataPacket } from '../utils/db-types';

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

    if (query.term_id) {
      conditions.push('term_id = ?');
      params.push(query.term_id);
    }

    if (query.department) {
      conditions.push('department = ?');
      params.push(query.department);
    }

    // 【多校区】按校区过滤
    if (query.campus) {
      conditions.push('campus = ?');
      params.push(query.campus);
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
    // 【修复】周次上限不再硬编码 18：优先用 total_weeks，否则从数据推导（下限18）
    let maxWeek = 18;
    if (query.total_weeks && query.total_weeks > 0) {
      maxWeek = query.total_weeks;
    } else {
      for (const course of allCourses) {
        const wl = course.weeks as unknown;
        if (Array.isArray(wl)) {
          for (const w of wl) {
            const iv = parseInt(String(w), 10);
            if (!isNaN(iv) && iv > maxWeek) maxWeek = iv;
          }
        }
      }
    }
    const weeks = query.week ? [query.week] : Array.from({ length: maxWeek }, (_, i) => i + 1);
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
   * 【多校区】获取校区列表（含默认值，保证白云即使没数据也出现）
   */
  async getCampuses(): Promise<string[]> {
    const defaults = ['河源', '白云'];
    try {
      const [rows] = await pool.execute('SELECT DISTINCT campus FROM schedules WHERE campus IS NOT NULL');
      const fromDb = (rows as { campus: string }[]).map(r => r.campus).filter(Boolean);
      const merged = Array.from(new Set([...defaults, ...fromDb]));
      return merged.sort();
    } catch {
      return defaults;
    }
  }

  /**
   * 获取所有空闲时间矩阵
   * 优化：一次性加载所有数据，内存中计算
   */
  async getAllFreeTimeData(termId?: number, campus?: string): Promise<{
    total_schedules: number;
    departments: string[];
    campus: string;
    people: { name: string; department: string; courses: { weekday: number; sections: number[]; weeks: number[] }[] }[];
  }> {
    let tid: number | undefined = termId;
    if (!tid) {
      const [terms] = await pool.execute("SELECT id FROM terms WHERE status = 'active' LIMIT 1");
      tid = (terms as RowDataPacket[])[0]?.id;
    }
    if (!tid) return { total_schedules: 0, departments: [], campus: campus || '', people: [] };
    // 【多校区】按校区过滤
    const campusCond = campus ? 'AND s.campus = ?' : '';
    const sqlParams: (string | number)[] = campus ? [tid, campus] : [tid];
    const [rows] = await pool.execute(`
      SELECT s.id as schedule_id, s.name, s.department, c.weekday, c.sections, c.weeks
      FROM schedules s
      JOIN terms t ON s.term_id = t.id
      LEFT JOIN courses c ON s.id = c.schedule_id
      WHERE t.id = ? ${campusCond}
    `, sqlParams);

    const personMap = new Map<string, { name: string; department: string; courses: { weekday: number; sections: number[]; weeks: number[] }[] }>();
    for (const row of rows as { schedule_id: number; name: string; department: string; weekday: number; sections: number[]; weeks: number[] }[]) {
      if (!personMap.has(row.name)) {
        personMap.set(row.name, { name: row.name, department: row.department, courses: [] });
      }
      if (row.weekday != null) {
        personMap.get(row.name)!.courses.push({
          weekday: row.weekday,
          sections: row.sections,
          weeks: row.weeks,
        });
      }
    }

    const scheduleNames = Array.from(personMap.keys());
    const departments = [...new Set(Array.from(personMap.values()).map(p => p.department))].sort();

    return {
      total_schedules: scheduleNames.length,
      departments,
      campus: campus || '',
      people: Array.from(personMap.values()),
    };
  }
}

export default new QueryService();
