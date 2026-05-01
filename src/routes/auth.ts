import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.ts';
import { authenticate, requireRole, AuthUser, JWT_SECRET } from '../middleware/auth.ts';

const router = Router();

function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

// =============================================
// 公开接口
// =============================================

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: '请输入用户名和密码' });
      return;
    }

    const [rows] = await pool.query(
      'SELECT id, username, name, email, role, department, avatar_url, password_hash, is_active FROM users WHERE username = ?',
      [username]
    );
    const users = rows as any[];

    if (users.length === 0) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const user = users[0];
    if (!user.is_active) {
      res.status(403).json({ success: false, error: '账号已被禁用' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    // 更新最后登录时间
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const tokenPayload: AuthUser = { userId: user.id, username: user.username, role: user.role };
    const token = generateToken(tokenPayload);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          avatar_url: user.avatar_url,
          last_login: user.last_login,
          created_at: user.created_at,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// 需登录接口
// =============================================

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, name, email, role, department, avatar_url, last_login, created_at FROM users WHERE id = ?',
      [req.user!.userId]
    );
    const users = rows as any[];
    if (users.length === 0) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }
    res.json({ success: true, data: users[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/auth/me
router.put('/me', authenticate, async (req, res) => {
  try {
    const { name, email, department } = req.body;
    const [result] = await pool.query(
      'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), department = COALESCE(?, department) WHERE id = ?',
      [name, email, department, req.user!.userId]
    );
    res.json({ success: true, data: { updated: (result as any).affectedRows > 0 } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/auth/password
router.put('/password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({ success: false, error: '请输入旧密码和新密码' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ success: false, error: '新密码长度至少6位' });
      return;
    }

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user!.userId]);
    const users = rows as any[];
    const valid = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!valid) {
      res.status(400).json({ success: false, error: '旧密码错误' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user!.userId]);
    res.json({ success: true, data: { message: '密码修改成功' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// 管理员接口
// =============================================

// GET /api/auth/users
router.get('/users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { search, role, page = '1', limit = '20' } = req.query;
    let sql = 'SELECT id, username, name, email, role, department, is_active, last_login, created_at FROM users WHERE 1=1';
    const params: any[] = [];

    if (search) {
      sql += ' AND (username LIKE ? OR name LIKE ? OR department LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), offset);

    const [rows] = await pool.query(sql, params);

    // 总数
    let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams: any[] = [];
    if (search) {
      countSql += ' AND (username LIKE ? OR name LIKE ? OR department LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (role) {
      countSql += ' AND role = ?';
      countParams.push(role);
    }
    const [countRows] = await pool.query(countSql, countParams);

    res.json({
      success: true,
      data: rows,
      meta: { total: (countRows as any[])[0].total, page: parseInt(page as string), limit: parseInt(limit as string) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/users
router.post('/users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { username, name, password, role = 'teacher', department, email } = req.body;
    if (!username || !name || !password) {
      res.status(400).json({ success: false, error: '用户名、姓名和密码为必填项' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, error: '密码长度至少6位' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, name, email, role, department, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [username, name, email || null, role, department || null, passwordHash]
    );
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, error: '用户名或邮箱已存在' });
      return;
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/auth/users/:id
router.put('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, role, department, email, is_active } = req.body;
    const [result] = await pool.query(
      'UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role), department = COALESCE(?, department), email = COALESCE(?, email), is_active = COALESCE(?, is_active) WHERE id = ?',
      [name, role, department, email, is_active, req.params.id]
    );
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/auth/users/:id/reset-password
router.put('/users/:id/reset-password', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: '新密码长度至少6位' });
      return;
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.params.id]);
    if ((result as any).affectedRows === 0) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
