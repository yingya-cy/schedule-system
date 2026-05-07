import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '753412',
  database: process.env.DB_NAME || 'schedule_system',
  charset: 'utf8mb4',
  connectionLimit: 20,
  waitForConnections: true,
  queueLimit: 50,
  connectTimeout: 10000,
  timezone: '+08:00',
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
  typeCast: true,
  queryFormat: undefined,
  stringifyObjects: false,
  insecureAuth: false,
  multipleStatements: false,
  flags: ['-FOUND_ROWS', '-IGNORE_SPACE', '-CLIENT_PROTOCOL_41', '-CLIENT_SECURE_CONNECTION', '-CLIENT_MULTI_RESULTS', '-CLIENT_PS_MULTI_RESULTS', '-CLIENT_SSL', '-CLIENT_TRANSACTIONS', '-CLIENT_MULTI_STATEMENTS']
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// ✅ 每次获取连接时强制设置 utf8mb4
pool.on('connection', (connection) => {
  // connection.promise() returns a promisified connection wrapper (mysql2)
  (connection as any).promise().query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci').catch(() => {});
});

/**
 * 确保索引存在，不存在则创建
 */
async function ensureIndex(
  connection: mysql.PoolConnection,
  table: string,
  indexName: string,
  indexColumns: string
): Promise<void> {
  try {
    const [rows] = await connection.query(
      `SHOW INDEX FROM ${table} WHERE Key_name = ?`,
      [indexName]
    );
    if ((rows as any[]).length === 0) {
      await connection.query(`CREATE INDEX ${indexName} ON ${table} ${indexColumns}`);
      console.log(`✅ Created index ${indexName} on ${table}`);
    }
  } catch (error) {
    console.log(`ℹ️  Index ${indexName} note:`, (error as Error).message);
  }
}

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

export async function initializeDatabase() {
  let connection = null;
  try {
    // 首先创建一个没有指定数据库的连接来创建数据库
    const tempConfig = { ...dbConfig };
    delete tempConfig.database; // 移除数据库名称，创建通用连接

    const tempPool = mysql.createPool(tempConfig);
    const adminConnection = await tempPool.getConnection();

    // 创建数据库（如果不存在）
    try {
      await adminConnection.query(`
        CREATE DATABASE IF NOT EXISTS schedule_system 
        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);
      console.log('✅ Database created or already exists');
    } catch (error) {
      console.log('ℹ️  Database creation note:', error.message);
    }

    adminConnection.release();
    await tempPool.end();

    // 现在使用正确的数据库连接
    connection = await pool.getConnection();

    // 强制设置连接字符集为 utf8mb4 - 最稳定的配置
    await connection.query(`SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci`);

    // 创建部门表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 添加部门表索引
    await ensureIndex(connection, 'departments', 'idx_departments_sort', '(sort_order)');

    // 创建课表表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        department VARCHAR(100) NOT NULL,
        filename VARCHAR(255),
        file_data LONGBLOB,
        file_type VARCHAR(100),
        storage_type ENUM('database', 'filesystem', 'object_storage') DEFAULT 'database',
        file_path VARCHAR(500),
        file_size BIGINT DEFAULT 0,
        file_hash VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_department (department),
        INDEX idx_name (name),
        INDEX idx_storage_type (storage_type),
        INDEX idx_file_hash (file_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 添加 schedules 表索引
    await ensureIndex(connection, 'schedules', 'idx_schedules_created', '(created_at DESC)');
    await ensureIndex(connection, 'schedules', 'idx_schedules_dept_name', '(department, name)');
    await ensureIndex(connection, 'schedules', 'idx_schedules_name', '(name)');
    await ensureIndex(connection, 'schedules', 'idx_schedules_storage_created', '(storage_type, created_at)');

    // 检查并添加新字段（如果不存在）
    try {
      const checkAndAddColumn = async (columnName: string, columnDefinition: string) => {
        const [columns] = await connection.query(`SHOW COLUMNS FROM schedules LIKE "${columnName}"`);
        if ((columns as any[]).length === 0) {
          await connection.query(`ALTER TABLE schedules ADD COLUMN ${columnName} ${columnDefinition}`);
          console.log(`✅ Added ${columnName} column to schedules table`);
        }
      };

      await checkAndAddColumn('file_data', 'LONGBLOB');
      await checkAndAddColumn('file_type', 'VARCHAR(100)');
      await checkAndAddColumn('storage_type', "ENUM('database', 'filesystem', 'object_storage') DEFAULT 'database'");
      await checkAndAddColumn('file_path', 'VARCHAR(500)');
      await checkAndAddColumn('file_size', 'BIGINT DEFAULT 0');
      await checkAndAddColumn('file_hash', 'VARCHAR(64)');
      await checkAndAddColumn('created_by', 'VARCHAR(100)');
      await checkAndAddColumn('email_verify_token', 'VARCHAR(64)');
      await checkAndAddColumn('email_verify_token_expires', 'TIMESTAMP NULL DEFAULT NULL');
      await checkAndAddColumn('email_verified_at', 'TIMESTAMP NULL DEFAULT NULL');

    } catch (alterError) {
      console.log('ℹ️  Column check/add note:', alterError.message);
    }

    // 创建课程表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        schedule_id INT NOT NULL,
        course_name VARCHAR(200) NOT NULL,
        weekday INT NOT NULL,
        sections JSON NOT NULL,
        weeks JSON NOT NULL,
        teacher VARCHAR(100),
        location VARCHAR(100),
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
        INDEX idx_schedule_id (schedule_id),
        INDEX idx_weekday (weekday)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 添加 courses 表索引
    await ensureIndex(connection, 'courses', 'idx_courses_schedule_weekday', '(schedule_id, weekday, sections(10))');

    // 检查部门表中是否有数据，如果没有则插入默认部门
    const [deptRows] = await connection.query('SELECT COUNT(*) as count FROM departments');
    const deptCount = (deptRows as any)[0].count;

    if (deptCount === 0) {
      await connection.query(`
        INSERT INTO departments (name, sort_order) VALUES
        ('主任团', 1),
        ('网编部', 2),
        ('秘书部', 3),
        ('策划部', 4),
        ('咨询部', 5),
        ('外联部', 6),
        ('宣传部', 7)
      `);
      console.log('✅ Default departments inserted');
    }

    // =============================================
    // 评分系统表
    // =============================================

    // 评分模板表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scoring_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        total_score DECIMAL(10,2) NOT NULL DEFAULT 100,
        category VARCHAR(100) DEFAULT 'general',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 评分维度表（主维度）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scoring_dimensions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_id INT NOT NULL,
        name VARCHAR(200) NOT NULL,
        max_score DECIMAL(10,2) NOT NULL,
        sort_order INT DEFAULT 0,
        is_optional TINYINT(1) DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES scoring_templates(id) ON DELETE CASCADE,
        INDEX idx_template_sort (template_id, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 检查并添加 scoring_dimensions 表的新字段（如果不存在）
    try {
      const [descColumns] = await connection.query(`SHOW COLUMNS FROM scoring_dimensions LIKE "description"`);
      if ((descColumns as any[]).length === 0) {
        await connection.query(`ALTER TABLE scoring_dimensions ADD COLUMN description TEXT`);
        console.log('✅ Added description column to scoring_dimensions table');
      }
    } catch (alterError) {
      console.log('ℹ️  Column check/add note:', alterError.message);
    }

    // 评分子维度表（二级指标）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scoring_subdimensions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dimension_id INT NOT NULL,
        name VARCHAR(200) NOT NULL,
        max_score DECIMAL(10,2) NOT NULL,
        sort_order INT DEFAULT 0,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dimension_id) REFERENCES scoring_dimensions(id) ON DELETE CASCADE,
        INDEX idx_dimension_sort (dimension_id, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 比赛会话表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS competitions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_id INT NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        status ENUM('preparing', 'scoring', 'completed', 'archived') DEFAULT 'preparing',
        judging_mode ENUM('offline', 'realtime') DEFAULT 'offline',
        result_published TINYINT(1) DEFAULT 0,
        start_time DATETIME,
        end_time DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES scoring_templates(id),
        INDEX idx_template_status (template_id, status),
        INDEX idx_status_time (status, start_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 选手表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contestants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        competition_id INT NOT NULL,
        number VARCHAR(50),
        name VARCHAR(200) NOT NULL,
        group_name VARCHAR(200),
        work_name VARCHAR(500),
        description TEXT,
        extra_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
        INDEX idx_competition_number (competition_id, number),
        INDEX idx_competition_name (competition_id, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 检查并添加 contestants 表的新字段（如果不存在）
    try {
      const [workNameColumns] = await connection.query(`SHOW COLUMNS FROM contestants LIKE "work_name"`);
      if ((workNameColumns as any[]).length === 0) {
        await connection.query(`ALTER TABLE contestants ADD COLUMN work_name VARCHAR(500)`);
        console.log('✅ Added work_name column to contestants table');
      }
    } catch (alterError) {
      console.log('ℹ️  Column check/add note:', alterError.message);
    }

    // 评委表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS judges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        competition_id INT NOT NULL,
        user_id INT DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE,
        INDEX idx_competition_active (competition_id, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 检查并添加 judges 表的 user_id 字段（兼容已有数据）
    try {
      const [userIdColumns] = await connection.query(`SHOW COLUMNS FROM judges LIKE "user_id"`);
      if ((userIdColumns as any[]).length === 0) {
        await connection.query(`ALTER TABLE judges ADD COLUMN user_id INT DEFAULT NULL`);
        console.log('✅ Added user_id column to judges table');
      }
    } catch (alterError) {
      console.log('ℹ️  Column check/add note:', (alterError as Error).message);
    }

    // 评分记录表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        competition_id INT NOT NULL,
        contestant_id INT NOT NULL,
        judge_id INT NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_score DECIMAL(10,2),
        is_valid TINYINT(1) DEFAULT 1,
        ip_address VARCHAR(50),
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (contestant_id) REFERENCES contestants(id),
        FOREIGN KEY (judge_id) REFERENCES judges(id),
        UNIQUE KEY uk_competition_contestant_judge (competition_id, contestant_id, judge_id),
        INDEX idx_competition_submitted (competition_id, submitted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 评分详情表（二级维度评分 + 主维度评分）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS score_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        score_id INT NOT NULL,
        subdimension_id INT DEFAULT NULL,
        dimension_id INT DEFAULT NULL,
        score DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (score_id) REFERENCES scores(id) ON DELETE CASCADE,
        FOREIGN KEY (subdimension_id) REFERENCES scoring_subdimensions(id) ON DELETE CASCADE,
        FOREIGN KEY (dimension_id) REFERENCES scoring_dimensions(id) ON DELETE CASCADE,
        UNIQUE KEY uk_score_subdimension (score_id, subdimension_id),
        UNIQUE KEY uk_score_dimension (score_id, dimension_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 检查并添加 score_details 表的新字段（如果不存在）
    try {
      const [dimColumns] = await connection.query(`SHOW COLUMNS FROM score_details LIKE "dimension_id"`);
      if ((dimColumns as any[]).length === 0) {
        await connection.query(`ALTER TABLE score_details ADD COLUMN dimension_id INT DEFAULT NULL`);
        console.log('✅ Added dimension_id column to score_details table');
      }
      // 修改 subdimension_id 为允许 NULL（支持主维度评分）
      // 注意：如果表已存在且 subdimension_id 是 NOT NULL，需要先修改为 NULL 才能插入只有 dimension_id 的记录
      const [subColumns] = await connection.query(`SHOW COLUMNS FROM score_details LIKE "subdimension_id"`);
      if ((subColumns as any[]).length > 0 && (subColumns as any[])[0].Null === 'NO') {
        await connection.query(`ALTER TABLE score_details MODIFY subdimension_id INT NULL`);
        console.log('✅ Modified subdimension_id to allow NULL');
      }
    } catch (alterError) {
      console.log('ℹ️  Column check/add note:', alterError.message);
    }

    // 计算结果表（最终排名）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS competition_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        competition_id INT NOT NULL,
        contestant_id INT NOT NULL,
        total_score DECIMAL(10,2),
        \`rank\` INT,
        avg_scores JSON,
        score_count INT,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (competition_id) REFERENCES competitions(id),
        FOREIGN KEY (contestant_id) REFERENCES contestants(id),
        UNIQUE KEY uk_competition_contestant (competition_id, contestant_id),
        INDEX idx_competition_rank (competition_id, \`rank\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 检查并添加 competition_results 表的新字段（如果不存在）
    try {
      const [columns] = await connection.query(`SHOW COLUMNS FROM competition_results LIKE "final_score"`);
      if ((columns as any[]).length === 0) {
        await connection.query(`ALTER TABLE competition_results ADD COLUMN final_score DECIMAL(10,2) AFTER total_score`);
      }
    } catch (err) {
      // 忽略错误
    }

    // =============================================
    // 用户认证系统表
    // =============================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL COMMENT '显示名称',
        email VARCHAR(200) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'teacher', 'student') DEFAULT 'teacher',
        department VARCHAR(100),
        avatar_url VARCHAR(500),
        is_active TINYINT(1) DEFAULT 1,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_role (role),
        INDEX idx_department (department),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 检查并创建默认管理员账号（admin/admin123）
    const [adminRows] = await connection.query(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      ['admin']
    );
    const adminCount = (adminRows as any)[0].count;
    if (adminCount === 0) {
      const defaultHash = await bcrypt.hash('admin123', 10);
      await connection.query(
        'INSERT INTO users (username, name, role, password_hash) VALUES (?, ?, ?, ?)',
        ['admin', '系统管理员', 'admin', defaultHash]
      );
      console.log('✅ Default admin user created (admin/admin123)');
    }

    // =============================================
    // 文件中心表
    // =============================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS file_activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        department VARCHAR(100) NOT NULL,
        cover_url VARCHAR(500),
        status ENUM('active', 'archived') DEFAULT 'active',
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_department (department),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS file_folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        activity_id INT NOT NULL,
        parent_id INT DEFAULT NULL,
        name VARCHAR(200) NOT NULL,
        sort_order INT DEFAULT 0,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES file_activities(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES file_folders(id) ON DELETE SET NULL,
        INDEX idx_activity_parent (activity_id, parent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS file_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        activity_id INT NOT NULL,
        folder_id INT DEFAULT NULL,
        original_filename VARCHAR(255) NOT NULL,
        stored_filename VARCHAR(255) NOT NULL,
        file_size BIGINT DEFAULT 0,
        mime_type VARCHAR(100),
        file_category ENUM('video', 'image', 'document', 'tweet') NOT NULL DEFAULT 'document',
        file_hash VARCHAR(64),
        oss_object_key VARCHAR(500),
        oss_url VARCHAR(1000),
        thumbnail_url VARCHAR(1000),
        description TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES file_activities(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES file_folders(id) ON DELETE SET NULL,
        INDEX idx_activity_folder (activity_id, folder_id),
        INDEX idx_category (file_category),
        INDEX idx_created_at (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 添加 file_items 表与课表中心的关联字段
    try {
      const [scheduleIdCols] = await connection.query(`SHOW COLUMNS FROM file_items LIKE "schedule_id"`);
      if ((scheduleIdCols as any[]).length === 0) {
        await connection.query(`ALTER TABLE file_items ADD COLUMN schedule_id INT DEFAULT NULL`);
        await connection.query(`ALTER TABLE file_items ADD INDEX idx_schedule_id (schedule_id)`);
        console.log('✅ Added schedule_id column to file_items table');
      }
    } catch (e: any) {
      console.log('ℹ️  schedule_id column note:', e.message);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS file_tweets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        activity_id INT NOT NULL,
        folder_id INT DEFAULT NULL,
        title VARCHAR(500) NOT NULL,
        content TEXT,
        summary VARCHAR(1000),
        cover_image VARCHAR(500),
        link_url VARCHAR(1000),
        author VARCHAR(100),
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES file_activities(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES file_folders(id) ON DELETE SET NULL,
        INDEX idx_activity (activity_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS file_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        activity_id INT NOT NULL,
        file_id INT DEFAULT NULL,
        folder_id INT DEFAULT NULL,
        permission_type ENUM('view', 'upload', 'edit', 'admin') NOT NULL,
        grantee_type ENUM('department', 'user') DEFAULT 'department',
        grantee_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES file_activities(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // 操作日志表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scoring_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        competition_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        operator_type ENUM('admin', 'judge') NOT NULL,
        operator_id VARCHAR(50),
        details JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_competition_action (competition_id, action),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    connection.release();
    console.log('✅ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    if (connection) {
      try {
        connection.release();
      } catch (e) {
        // 忽略释放错误
      }
    }
    return false;
  }
}

export default pool;