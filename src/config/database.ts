import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { RowDataPacket } from '../utils/db-types';

export const dbConfig = {
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
  // @ts-expect-error mysql2 types missing promise() on PoolConnection
  connection.promise().query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci').catch(() => {});
});

/**
 * 确保索引存在，不存在则创建
 */
export async function ensureIndex(
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
    if ((rows as RowDataPacket[]).length === 0) {
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


export default pool;
