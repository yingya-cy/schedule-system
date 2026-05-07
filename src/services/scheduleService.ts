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
import { scheduleRepository } from '../repositories/ScheduleRepository';

export class ScheduleService {
  // ==================== Department Operations ====================

  async getAllDepartments(): Promise<Department[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM departments ORDER BY sort_order ASC'
    );
    return rows as Department[];
  }

  // ==================== Schedule Operations (delegated to Repository) ====================

  async getAllSchedules(filters?: { department?: string; name?: string }): Promise<Schedule[]> {
    return scheduleRepository.findAll(filters);
  }

  async getScheduleById(id: number): Promise<Schedule | null> {
    return scheduleRepository.findById(id);
  }

  async getScheduleWithCourses(id: number): Promise<Schedule | null> {
    return scheduleRepository.findWithCourses(id);
  }

  async createSchedule(dto: CreateScheduleDto): Promise<Schedule> {
    let fileMetadata: FileMetadata | null = null;

    if (dto.file_data && dto.filename) {
      const fileBuffer = Buffer.from(dto.file_data, 'base64');
      fileMetadata = await fileStorageService.storeFile(
        dto.filename,
        fileBuffer,
        dto.file_type || 'application/octet-stream'
      );
    }

    // 构建带文件元数据的 DTO
    const scheduleDto: CreateScheduleDto = {
      ...dto,
      filename: fileMetadata?.filename || dto.filename,
      file_data: dto.file_data, // 保留原始 base64，避免二次编码
      file_type: fileMetadata?.fileType || dto.file_type || 'application/octet-stream',
      storage_type: fileMetadata?.storageType || 'database',
      file_path: fileMetadata?.filePath || null,
      file_size: fileMetadata?.fileSize || 0,
      file_hash: fileMetadata?.fileHash || null,
    };

    return scheduleRepository.create(scheduleDto);
  }

  async updateSchedule(id: number, dto: UpdateScheduleDto): Promise<Schedule | null> {
    return scheduleRepository.update(id, dto);
  }

  async deleteSchedule(id: number): Promise<boolean> {
    // 先获取文件信息，用于后续清理
    const fileInfo = await scheduleRepository.getFileInfo(id);
    const deleted = await scheduleRepository.delete(id);

    // 如果删除成功，清理文件
    if (deleted && fileInfo) {
      const fileMetadata: FileMetadata = {
        filename: fileInfo.filename || '',
        fileType: fileInfo.file_type || '',
        fileSize: 0,
        fileHash: fileInfo.file_hash || '',
        storageType: fileInfo.storage_type as 'database' | 'filesystem' | 'object_storage',
        filePath: fileInfo.file_path || ''
      };

      await fileStorageService.deleteFile(fileMetadata).catch(error => {
        console.error(`Error deleting file for schedule ${id}:`, error);
      });
    }

    return deleted;
  }

  async getScheduleFile(id: number): Promise<{ file_data: Buffer; file_type: string; filename: string } | null> {
    const fileInfo = await scheduleRepository.getFileInfo(id);
    if (!fileInfo) {
      return null;
    }

    const fileMetadata: FileMetadata = {
      filename: fileInfo.filename || '',
      fileType: fileInfo.file_type || '',
      fileSize: 0,
      fileHash: fileInfo.file_hash || '',
      storageType: fileInfo.storage_type as 'database' | 'filesystem' | 'object_storage',
      filePath: fileInfo.file_path || '',
      fileData: fileInfo.file_data || undefined
    };

    try {
      const fileBuffer = await fileStorageService.getFile(fileMetadata);

      return {
        file_data: fileBuffer,
        file_type: fileInfo.file_type || 'application/octet-stream',
        filename: fileInfo.filename || 'schedule_file'
      };
    } catch (error) {
      console.error(`Error getting file for schedule ${id}:`, error);
      return null;
    }
  }

  // ==================== Course Operations (delegated to Repository) ====================

  async createCourse(scheduleId: number, dto: CreateCourseDto): Promise<Course> {
    return scheduleRepository.createCourse(scheduleId, dto);
  }

  async updateCourse(id: number, dto: UpdateCourseDto): Promise<Course | null> {
    return scheduleRepository.updateCourse(id, dto);
  }

  async deleteCourse(id: number): Promise<boolean> {
    return scheduleRepository.deleteCourse(id);
  }

  async getCoursesByScheduleId(scheduleId: number): Promise<Course[]> {
    return scheduleRepository.findCoursesByScheduleId(scheduleId);
  }
}

export default new ScheduleService();
