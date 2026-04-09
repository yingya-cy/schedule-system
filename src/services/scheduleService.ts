import pool from '../config/database';
import {
  Schedule,
  Course,
  CreateScheduleDto,
  CreateCourseDto,
  UpdateScheduleDto,
  UpdateCourseDto,
  Department
} from '../types/database';
import { fileStorageService, FileMetadata } from './fileStorageService';

export class ScheduleService {
  async getAllDepartments(): Promise<Department[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM departments ORDER BY sort_order ASC'
    );
    return rows as Department[];
  }

  async getAllSchedules(filters?: { department?: string; name?: string }): Promise<Schedule[]> {
    let query = 'SELECT * FROM schedules';
    const params: any[] = [];
    const conditions: string[] = [];

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

  async getScheduleById(id: number): Promise<Schedule | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM schedules WHERE id = ?',
      [id]
    );
    const schedules = rows as Schedule[];
    return schedules.length > 0 ? schedules[0] : null;
  }

  async getScheduleWithCourses(id: number): Promise<Schedule | null> {
    const schedule = await this.getScheduleById(id);
    if (!schedule) return null;

    const [courseRows] = await pool.execute(
      'SELECT * FROM courses WHERE schedule_id = ? ORDER BY weekday ASC, sections ASC',
      [id]
    );
    schedule.courses = courseRows as Course[];

    return schedule;
  }

  async createSchedule(dto: CreateScheduleDto): Promise<Schedule> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      console.log('📝 createSchedule received:', {
        hasFileData: !!dto.file_data,
        fileDataLength: dto.file_data?.length,
        fileType: dto.file_type,
        filename: dto.filename
      });

      let fileMetadata: FileMetadata | null = null;
      
      if (dto.file_data && dto.filename) {
        const fileBuffer = Buffer.from(dto.file_data, 'base64');
        fileMetadata = await fileStorageService.storeFile(
          dto.filename,
          fileBuffer,
          dto.file_type || 'application/octet-stream'
        );
      }

      const [result] = await connection.execute(
        `INSERT INTO schedules (name, department, filename, file_data, file_type, storage_type, file_path, file_size, file_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.name,
          dto.department,
          fileMetadata?.filename || dto.filename || null,
          fileMetadata?.fileData || null,
          fileMetadata?.fileType || dto.file_type || null,
          fileMetadata?.storageType || 'database',
          fileMetadata?.filePath || null,
          fileMetadata?.fileSize || 0,
          fileMetadata?.fileHash || null
        ]
      );

      const scheduleId = (result as any).insertId;

      for (const courseDto of dto.courses) {
        await connection.execute(
          `INSERT INTO courses (schedule_id, course_name, weekday, sections, weeks, teacher, location, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            scheduleId,
            courseDto.course_name,
            courseDto.weekday,
            JSON.stringify(courseDto.sections),
            JSON.stringify(courseDto.weeks),
            courseDto.teacher || null,
            courseDto.location || null,
            courseDto.remark || null
          ]
        );
      }

      await connection.commit();
      return await this.getScheduleWithCourses(scheduleId) as Schedule;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateSchedule(id: number, dto: UpdateScheduleDto): Promise<Schedule | null> {
    const updates: string[] = [];
    const params: any[] = [];

    if (dto.name !== undefined) {
      updates.push('name = ?');
      params.push(dto.name);
    }

    if (dto.department !== undefined) {
      updates.push('department = ?');
      params.push(dto.department);
    }

    if (dto.filename !== undefined) {
      updates.push('filename = ?');
      params.push(dto.filename);
    }

    if (updates.length === 0) {
      return await this.getScheduleById(id);
    }

    params.push(id);
    await pool.execute(
      `UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return await this.getScheduleById(id);
  }

  async deleteSchedule(id: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 先获取文件信息
      const [rows] = await connection.execute(
        'SELECT filename, file_type, storage_type, file_path, file_hash FROM schedules WHERE id = ?',
        [id]
      );
      const schedule = (rows as any[])[0];

      // 删除相关课程
      await connection.execute('DELETE FROM courses WHERE schedule_id = ?', [id]);
      const [result] = await connection.execute('DELETE FROM schedules WHERE id = ?', [id]);

      await connection.commit();

      // 如果删除成功，清理文件
      if ((result as any).affectedRows > 0 && schedule) {
        const fileMetadata: FileMetadata = {
          filename: schedule.filename,
          fileType: schedule.file_type,
          fileSize: 0,
          fileHash: schedule.file_hash,
          storageType: schedule.storage_type,
          filePath: schedule.file_path
        };
        
        await fileStorageService.deleteFile(fileMetadata).catch(error => {
          console.error(`Error deleting file for schedule ${id}:`, error);
        });
      }

      return (result as any).affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getScheduleFile(id: number): Promise<{ file_data: Buffer; file_type: string; filename: string } | null> {
    const [rows] = await pool.execute(
      'SELECT filename, file_type, storage_type, file_path, file_data, file_hash FROM schedules WHERE id = ?',
      [id]
    );
    const schedules = rows as any[];
    if (schedules.length === 0) {
      return null;
    }

    const schedule = schedules[0];
    
    // 构建文件元数据
    const fileMetadata: FileMetadata = {
      filename: schedule.filename,
      fileType: schedule.file_type,
      fileSize: 0,
      fileHash: schedule.file_hash,
      storageType: schedule.storage_type,
      filePath: schedule.file_path,
      fileData: schedule.file_data ? Buffer.from(schedule.file_data) : undefined
    };

    try {
      // 使用文件存储服务获取文件内容
      const fileBuffer = await fileStorageService.getFile(fileMetadata);
      
      return {
        file_data: fileBuffer,
        file_type: schedule.file_type || 'application/octet-stream',
        filename: schedule.filename || 'schedule_file'
      };
    } catch (error) {
      console.error(`Error getting file for schedule ${id}:`, error);
      return null;
    }
  }

  async createCourse(scheduleId: number, dto: CreateCourseDto): Promise<Course> {
    const [result] = await pool.execute(
      `INSERT INTO courses (schedule_id, course_name, weekday, sections, weeks, teacher, location, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId,
        dto.course_name,
        dto.weekday,
        JSON.stringify(dto.sections),
        JSON.stringify(dto.weeks),
        dto.teacher || null,
        dto.location || null,
        dto.remark || null
      ]
    );

    const courseId = (result as any).insertId;
    const [rows] = await pool.execute(
      'SELECT * FROM courses WHERE id = ?',
      [courseId]
    );
    return (rows as Course[])[0];
  }

  async updateCourse(id: number, dto: UpdateCourseDto): Promise<Course | null> {
    const updates: string[] = [];
    const params: any[] = [];

    if (dto.course_name !== undefined) {
      updates.push('course_name = ?');
      params.push(dto.course_name);
    }

    if (dto.weekday !== undefined) {
      updates.push('weekday = ?');
      params.push(dto.weekday);
    }

    if (dto.sections !== undefined) {
      updates.push('sections = ?');
      params.push(JSON.stringify(dto.sections));
    }

    if (dto.weeks !== undefined) {
      updates.push('weeks = ?');
      params.push(JSON.stringify(dto.weeks));
    }

    if (dto.teacher !== undefined) {
      updates.push('teacher = ?');
      params.push(dto.teacher);
    }

    if (dto.location !== undefined) {
      updates.push('location = ?');
      params.push(dto.location);
    }

    if (dto.remark !== undefined) {
      updates.push('remark = ?');
      params.push(dto.remark);
    }

    if (updates.length === 0) {
      const [rows] = await pool.execute('SELECT * FROM courses WHERE id = ?', [id]);
      const courses = rows as Course[];
      return courses.length > 0 ? courses[0] : null;
    }

    params.push(id);
    await pool.execute(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const [rows] = await pool.execute('SELECT * FROM courses WHERE id = ?', [id]);
    const courses = rows as Course[];
    return courses.length > 0 ? courses[0] : null;
  }

  async deleteCourse(id: number): Promise<boolean> {
    const [result] = await pool.execute(
      'DELETE FROM courses WHERE id = ?',
      [id]
    );
    return (result as any).affectedRows > 0;
  }

  async getCoursesByScheduleId(scheduleId: number): Promise<Course[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM courses WHERE schedule_id = ? ORDER BY weekday ASC, sections ASC',
      [scheduleId]
    );
    return rows as Course[];
  }
}

export default new ScheduleService();
