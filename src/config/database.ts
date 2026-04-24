import mysql from 'mysql2/promise';

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

// ✅ 终极强制方案：每次获取连接都强制设置 utf8mb4
pool.on('connection', (connection) => {
  connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
  console.log('🔗 新连接已强制设置为 utf8mb4');
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