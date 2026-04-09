import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import pool from '../config/database';

export type StorageType = 'database' | 'filesystem' | 'object_storage';

export interface FileMetadata {
  filename: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  storageType: StorageType;
  filePath?: string;
  fileData?: Buffer;
}

export class FileStorageService {
  private readonly uploadDir: string;
  private readonly maxDatabaseSize = 5 * 1024 * 1024; // 5MB

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }

  /**
   * 计算文件哈希值（SHA256）
   */
  private async calculateFileHash(buffer: Buffer): Promise<string> {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * 存储文件
   */
  async storeFile(
    filename: string,
    fileBuffer: Buffer,
    fileType: string = 'application/octet-stream'
  ): Promise<FileMetadata> {
    const fileSize = fileBuffer.length;
    const fileHash = await this.calculateFileHash(fileBuffer);

    // 检查是否已存在相同文件
    const existingFile = await this.findFileByHash(fileHash);
    if (existingFile) {
      return {
        filename,
        fileType,
        fileSize,
        fileHash,
        storageType: existingFile.storageType,
        filePath: existingFile.filePath,
        fileData: existingFile.fileData
      };
    }

    // 根据文件大小选择存储方式
    let storageType: StorageType = 'database';
    let filePath: string | undefined;
    let storedFileData: Buffer | undefined;

    if (fileSize <= this.maxDatabaseSize) {
      // 小文件：存储在数据库
      storedFileData = fileBuffer;
    } else {
      // 大文件：存储在文件系统
      storageType = 'filesystem';
      const safeFilename = this.generateSafeFilename(filename);
      filePath = path.join(this.uploadDir, safeFilename);
      
      await fs.writeFile(filePath, fileBuffer);
      storedFileData = undefined; // 不存储在数据库
    }

    return {
      filename,
      fileType,
      fileSize,
      fileHash,
      storageType,
      filePath,
      fileData: storedFileData
    };
  }

  /**
   * 根据哈希查找文件
   */
  private async findFileByHash(fileHash: string): Promise<FileMetadata | null> {
    try {
      const [rows] = await pool.execute(
        'SELECT filename, file_type, file_size, storage_type, file_path, file_data FROM schedules WHERE file_hash = ? LIMIT 1',
        [fileHash]
      );

      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0] as any;
        return {
          filename: row.filename,
          fileType: row.file_type,
          fileSize: row.file_size,
          fileHash,
          storageType: row.storage_type,
          filePath: row.file_path,
          fileData: row.file_data ? Buffer.from(row.file_data) : undefined
        };
      }
      return null;
    } catch (error) {
      console.error('Error finding file by hash:', error);
      return null;
    }
  }

  /**
   * 获取文件内容
   */
  async getFile(fileMetadata: FileMetadata): Promise<Buffer> {
    switch (fileMetadata.storageType) {
      case 'database':
        if (fileMetadata.fileData) {
          return fileMetadata.fileData;
        }
        throw new Error('File data not found in database');

      case 'filesystem':
        if (fileMetadata.filePath) {
          return await fs.readFile(fileMetadata.filePath);
        }
        throw new Error('File path not specified');

      default:
        throw new Error(`Unsupported storage type: ${fileMetadata.storageType}`);
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(fileMetadata: FileMetadata): Promise<void> {
    try {
      // 删除文件系统上的文件
      if (fileMetadata.storageType === 'filesystem' && fileMetadata.filePath) {
        await fs.unlink(fileMetadata.filePath).catch(() => {
          // 文件可能已被删除，忽略错误
        });
      }

      // 检查是否还有其他引用
      const [rows] = await pool.execute(
        'SELECT COUNT(*) as count FROM schedules WHERE file_hash = ?',
        [fileMetadata.fileHash]
      );

      const count = (rows as any[])[0]?.count || 0;
      if (count === 0 && fileMetadata.storageType === 'filesystem' && fileMetadata.filePath) {
        // 没有其他引用，删除文件
        await fs.unlink(fileMetadata.filePath).catch(() => {
          // 忽略错误
        });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  /**
   * 生成安全的文件名
   */
  private generateSafeFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const extension = path.extname(originalFilename);
    const basename = path.basename(originalFilename, extension);
    
    // 移除特殊字符
    const safeBasename = basename.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    return `${safeBasename}_${timestamp}_${random}${extension}`;
  }

  /**
   * 清理临时文件
   */
  async cleanupOldFiles(maxAgeDays: number = 30): Promise<void> {
    try {
      const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
      
      // 查找需要清理的文件
      const [rows] = await pool.execute(
        'SELECT file_path FROM schedules WHERE storage_type = ? AND created_at < ?',
        ['filesystem', new Date(cutoffTime).toISOString()]
      );

      for (const row of rows as any[]) {
        if (row.file_path) {
          await fs.unlink(row.file_path).catch(() => {
            // 忽略错误
          });
        }
      }
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }
}

// 导出单例实例
export const fileStorageService = new FileStorageService();