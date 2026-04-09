import { fileStorageService } from '../services/fileStorageService';

/**
 * 文件清理脚本
 * 用于定期清理旧文件
 */
async function cleanupFiles() {
  console.log('🧹 Starting file cleanup...');
  
  try {
    // 清理30天前的文件
    await fileStorageService.cleanupOldFiles(30);
    
    console.log('✅ File cleanup completed successfully');
  } catch (error) {
    console.error('❌ File cleanup failed:', error);
    process.exit(1);
  }
}

// 如果是直接运行此脚本
if (require.main === module) {
  cleanupFiles().then(() => {
    console.log('🧹 Cleanup script finished');
    process.exit(0);
  });
}

export { cleanupFiles };