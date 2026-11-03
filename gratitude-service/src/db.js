import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: +(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'gratitude',
  waitForConnections: true,
  connectionLimit: 20,
  charset: 'utf8mb4',
  // 让 JSON/TEXT 正常返回
  dateStrings: ['DATE', 'DATETIME'],
});

export async function q(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function q1(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

// 活动配置
export async function getConfig() {
  const rows = await q('SELECT k, v FROM gratitude_config');
  const cfg = {};
  for (const r of rows) cfg[r.k] = r.v;
  return cfg;
}

// 21 天日期表（从起始日推）
export function buildDays(startDate, total = 21) {
  const out = [];
  const [y, m, d] = startDate.split('-').map(Number);
  for (let i = 0; i < total; i++) {
    const dt = new Date(y, m - 1, d + i);
    out.push({
      day_no: i + 1,
      date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
      label: `${dt.getMonth() + 1}月${dt.getDate()}日`,
      weekday: ['日', '一', '二', '三', '四', '五', '六'][dt.getDay()],
    });
  }
  return out;
}
