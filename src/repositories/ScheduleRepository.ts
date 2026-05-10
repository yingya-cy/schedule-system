import pool from '../config/database';
import { Schedule, Course } from '../types/database';
import { CreateScheduleDto, CreateCourseDto, UpdateScheduleDto, UpdateCourseDto } from '../types/database';
import { buildInsertQuery, buildUpdateQuery, getInsertId, getAffectedRows } from '../utils/sqlBuilder';

export class ScheduleRepository {
  // ==================== Schedule Operations ====================

  async findAll(filters?: { department?: string; name?: string; term_id?: number }): Promise<Schedule[]> {
    let query = 'SELECT * FROM schedules';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (filters?.term_id) {
      conditions.push('term_id = ?');
      params.push(filters.term_id);
    }

    if (filters?.department) {
      conditions.push('department = ?');
      params.push(filters.department);
    }

    if (filters?.name) {
      conditions.push('name LIKE ?');
      params.push(`%${filters.name}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(query, params);
    return rows as Schedule[];
  }

  async findById(id: number): Promise<Schedule | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM schedules WHERE id = ?',
      [id]
    );
    const schedules = rows as Schedule[];
    return schedules.length > 0 ? schedules[0] : null;
  }

  async findWithCourses(id: number): Promise<Schedule | null> {
    const schedule = await this.findById(id);
    if (!schedule) return null;

    const [courseRows] = await pool.execute(
      'SELECT * FROM courses WHERE schedule_id = ? ORDER BY weekday ASC, sections ASC',
      [id]
    );
    schedule.courses = courseRows as Course[];

    return schedule;
  }

  async create(dto: CreateScheduleDto): Promise<Schedule> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Default to active term
      let termId = (dto as any).term_id;
      if (!termId) {
        const [terms] = await connection.query("SELECT id FROM terms WHERE status = 'active' LIMIT 1");
        termId = (terms as any[])[0]?.id;
      }

      const scheduleInsert = {
        name: dto.name,
        department: dto.department,
        term_id: termId,
        filename: dto.filename || null,
        file_data: dto.file_data || null,
        file_type: dto.file_type || null,
        storage_type: dto.storage_type || 'database',
        file_path: dto.file_path || null,
        file_size: dto.file_size || 0,
        file_hash: dto.file_hash || null,
        created_by: dto.created_by || null,
      };

      const { query, params } = buildInsertQuery('schedules', scheduleInsert);
      const [result] = await connection.execute(query, params);
      const scheduleId = getInsertId(result);

      for (const courseDto of dto.courses) {
        const courseInsert = {
          schedule_id: scheduleId,
          course_name: courseDto.course_name,
          weekday: courseDto.weekday,
          sections: JSON.stringify(courseDto.sections),
          weeks: JSON.stringify(courseDto.weeks),
          teacher: courseDto.teacher || null,
          location: courseDto.location || null,
          remark: courseDto.remark || null
        };
        const { query: q, params: p } = buildInsertQuery('courses', courseInsert);
        await connection.execute(q, p);
      }

      await connection.commit();
      return await this.findWithCourses(scheduleId) as Schedule;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id: number, dto: UpdateScheduleDto): Promise<Schedule | null> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { query, params } = buildUpdateQuery(
        'schedules',
        {
          name: dto.name,
          department: dto.department,
          filename: dto.filename
        },
        'id = ?',
        [id]
      );

      await connection.execute(query, params);

      const [rows] = await connection.execute('SELECT * FROM schedules WHERE id = ?', [id]);
      const schedules = rows as Schedule[];

      await connection.commit();

      return schedules.length > 0 ? schedules[0] : null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async delete(id: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 先获取文件信息
      const [rows] = await connection.execute(
        'SELECT filename, file_type, storage_type, file_path, file_hash FROM schedules WHERE id = ?',
        [id]
      );
      const scheduleRow = (rows as Record<string, unknown>[])[0];

      // 删除相关课程
      await connection.execute('DELETE FROM courses WHERE schedule_id = ?', [id]);
      const [result] = await connection.execute('DELETE FROM schedules WHERE id = ?', [id]);

      await connection.commit();

      return getAffectedRows(result) > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getFileInfo(id: number): Promise<{
    filename: string | null;
    file_type: string | null;
    storage_type: string;
    file_path: string | null;
    file_data: Buffer | null;
    file_hash: string | null;
  } | null> {
    const [rows] = await pool.execute(
      'SELECT filename, file_type, storage_type, file_path, file_data, file_hash FROM schedules WHERE id = ?',
      [id]
    );
    const scheduleRows = rows as Record<string, unknown>[];
    if (scheduleRows.length === 0) {
      return null;
    }

    const row = scheduleRows[0];
    return {
      filename: row.filename as string | null,
      file_type: row.file_type as string | null,
      storage_type: row.storage_type as string,
      file_path: row.file_path as string | null,
      file_data: row.file_data as Buffer | null,
      file_hash: row.file_hash as string | null
    };
  }

  // ==================== Course Operations ====================

  async createCourse(scheduleId: number, dto: CreateCourseDto): Promise<Course> {
    const { query, params } = buildInsertQuery('courses', {
      schedule_id: scheduleId,
      course_name: dto.course_name,
      weekday: dto.weekday,
      sections: JSON.stringify(dto.sections),
      weeks: JSON.stringify(dto.weeks),
      teacher: dto.teacher || null,
      location: dto.location || null,
      remark: dto.remark || null
    });

    const [result] = await pool.execute(query, params);
    const courseId = getInsertId(result);

    const [rows] = await pool.execute(
      'SELECT * FROM courses WHERE id = ?',
      [courseId]
    );
    return (rows as Course[])[0];
  }

  async updateCourse(id: number, dto: UpdateCourseDto): Promise<Course | null> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { query, params } = buildUpdateQuery(
        'courses',
        {
          course_name: dto.course_name,
          weekday: dto.weekday,
          sections: dto.sections !== undefined ? JSON.stringify(dto.sections) : undefined,
          weeks: dto.weeks !== undefined ? JSON.stringify(dto.weeks) : undefined,
          teacher: dto.teacher,
          location: dto.location,
          remark: dto.remark
        },
        'id = ?',
        [id]
      );

      await connection.execute(query, params);

      const [rows] = await connection.execute('SELECT * FROM courses WHERE id = ?', [id]);
      const courses = rows as Course[];

      await connection.commit();

      return courses.length > 0 ? courses[0] : null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteCourse(id: number): Promise<boolean> {
    const [result] = await pool.execute(
      'DELETE FROM courses WHERE id = ?',
      [id]
    );
    return getAffectedRows(result) > 0;
  }

  async findCoursesByScheduleId(scheduleId: number): Promise<Course[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM courses WHERE schedule_id = ? ORDER BY weekday ASC, sections ASC',
      [scheduleId]
    );
    return rows as Course[];
  }
}

export const scheduleRepository = new ScheduleRepository();
