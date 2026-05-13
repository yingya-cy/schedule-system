import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/database.ts';
import { authenticate, requireRole, AuthUser, JWT_SECRET } from '../middleware/auth.ts';
import { sendVerificationEmail } from '../services/emailService.ts';
import { validate, loginSchema, registerSchema } from '../utils/validation.ts';
import { RowDataPacket, ResultSetHeader, getErrorMessage, isDuplicateEntry } from '../utils/db-types';

const router = Router();

function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

// =============================================
// 公开接口
// =============================================

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;

    const [rows] = await pool.query(
      'SELECT id, username, name, email, email_verify_token, email_verified_at, role, department, avatar_url, password_hash, is_active FROM users WHERE (username = ? OR email = ?)',
      [username, username]
    );
    const users = rows as RowDataPacket[];

    if (users.length === 0) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const user = users[0];
    if (!user.is_active) {
      res.status(403).json({ success: false, error: '账号已被禁用' });
      return;
    }

    if (user.email && !user.email_verified_at) {
      res.status(403).json({ success: false, error: '请先验证邮箱后再登录', needVerify: true, email: user.email });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const tokenPayload: AuthUser = { userId: user.id, username: user.username, role: user.role, department: user.department };
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { username, email, password, name } = req.body;

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (username, name, email, password_hash, role, is_active, email_verify_token, email_verify_token_expires) VALUES (?, ?, ?, ?, ?, 1, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
      [username, name, email, passwordHash, 'student', verifyToken]
    );

    // Send verification email (non-blocking)
    sendVerificationEmail(email, name, verifyToken).catch((e) =>
      console.error('Failed to send verification email:', e.message)
    );

    res.json({ success: true, data: { message: '注册成功，请查收验证邮件' } });
  } catch (error: unknown) {
    if (isDuplicateEntry(error)) {
      res.status(400).json({ success: false, error: '用户名或邮箱已被注册' });
      return;
    }
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, error: '缺少验证令牌' });
      return;
    }

    const [rows] = await pool.query(
      'SELECT id, email_verify_token_expires FROM users WHERE email_verify_token = ? AND email_verified_at IS NULL',
      [token]
    );
    if ((rows as RowDataPacket[]).length === 0) {
      const [verified] = await pool.query(
        'SELECT id FROM users WHERE email_verify_token = ? AND email_verified_at IS NOT NULL',
        [token]
      );
      if ((verified as RowDataPacket[]).length > 0) {
        res.json({ success: true, data: { message: '邮箱已验证，请登录', alreadyVerified: true } });
        return;
      }
      res.status(400).json({ success: false, error: '验证链接无效或已过期' });
      return;
    }

    const user = (rows as RowDataPacket[])[0];
    if (user.email_verify_token_expires && new Date(user.email_verify_token_expires) < new Date()) {
      res.status(400).json({ success: false, error: '验证链接已过期，请重新发送验证邮件' });
      return;
    }

    await pool.query(
      'UPDATE users SET email_verified_at = NOW() WHERE id = ?',
      [(rows as RowDataPacket[])[0].id]
    );

    res.json({ success: true, data: { message: '邮箱验证成功，请登录' } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// POST /api/auth/verify-email/resend
router.post('/verify-email/resend', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: '请输入邮箱' });
      return;
    }

    const [rows] = await pool.query(
      'SELECT id, username, name, email_verified_at FROM users WHERE email = ?',
      [email]
    );
    const users = rows as RowDataPacket[];
    if (users.length === 0) {
      res.status(400).json({ success: false, error: '该邮箱未注册' });
      return;
    }

    const user = users[0];
    if (user.email_verified_at) {
      res.json({ success: true, data: { message: '邮箱已验证，请直接登录' } });
      return;
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE users SET email_verify_token = ?, email_verify_token_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?', [verifyToken, user.id]);

    sendVerificationEmail(email, user.name || user.username, verifyToken).catch((e) =>
      console.error('Failed to resend verification email:', e.message)
    );

    res.json({ success: true, data: { message: '验证邮件已重新发送' } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
    const users = rows as RowDataPacket[];
    if (users.length === 0) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }
    res.json({ success: true, data: users[0] });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
    res.json({ success: true, data: { updated: (result as ResultSetHeader).affectedRows > 0 } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
    const users = rows as RowDataPacket[];
    const valid = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!valid) {
      res.status(400).json({ success: false, error: '旧密码错误' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user!.userId]);
    res.json({ success: true, data: { message: '密码修改成功' } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// =============================================
// 管理员接口
// =============================================

// GET /api/auth/users
router.get('/users', authenticate, async (req, res) => {
  try {
    const user = req.user!;
    // Only admin and department_head can list users
    if (user.role !== 'admin' && user.role !== 'department_head') {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }

    const { search, role, department, status, page = '1', limit = '20' } = req.query;
    let sql = 'SELECT id, username, name, email, role, department, is_active, last_login, created_at FROM users WHERE 1=1';
    const params: (string | number)[] = [];

    // Department head can only see their department
    if (user.role === 'department_head') {
      sql += ' AND department = ?';
      params.push(user.department ?? '');
    }

    if (search) {
      sql += ' AND (username LIKE ? OR name LIKE ? OR department LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (role) {
      sql += ' AND role = ?';
      params.push(String(role));
    }
    if (department) {
      sql += ' AND department = ?';
      params.push(String(department));
    }
    if (status === 'active') {
      sql += ' AND is_active = 1';
    } else if (status === 'disabled') {
      sql += ' AND is_active = 0';
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), offset);

    const [rows] = await pool.query(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams: (string | number)[] = [];
    if (user.role === 'department_head') {
      countSql += ' AND department = ?';
      countParams.push(user.department ?? '');
    }
    if (search) {
      countSql += ' AND (username LIKE ? OR name LIKE ? OR department LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (role) {
      countSql += ' AND role = ?';
      countParams.push(String(role));
    }
    const [countRows] = await pool.query(countSql, countParams);

    res.json({
      success: true,
      data: rows,
      meta: { total: (countRows as RowDataPacket[])[0].total, page: parseInt(page as string), limit: parseInt(limit as string) },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
    // Admin-created users are auto-verified (no email verification needed)
    const [result] = await pool.query(
      'INSERT INTO users (username, name, email, role, department, password_hash, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [username, name, email || null, role, department || null, passwordHash]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    if (isDuplicateEntry(error)) {
      res.status(400).json({ success: false, error: '用户名或邮箱已存在' });
      return;
    }
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// PUT /api/auth/users/:id
router.put('/users/:id', authenticate, async (req, res) => {
  try {
    const editor = req.user!;

    // Admin can edit everything; department_head can edit same-dept members
    if (editor.role !== 'admin' && editor.role !== 'department_head') {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }

    // Check target user
    const [targetRows] = await pool.query('SELECT id, department FROM users WHERE id = ?', [req.params.id]);
    const target = (targetRows as RowDataPacket[])[0];
    if (!target) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    if (editor.role === 'department_head') {
      if (target.department !== editor.department) {
        res.status(403).json({ success: false, error: '只能编辑本部门成员' });
        return;
      }
      // Department head can only edit name, email, department
      const { name, email, department } = req.body;
      await pool.query(
        'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), department = COALESCE(?, department) WHERE id = ?',
        [name, email, department, req.params.id]
      );
    } else {
      const { name, role, department, email, is_active } = req.body;
      await pool.query(
        'UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role), department = COALESCE(?, department), email = COALESCE(?, email), is_active = COALESCE(?, is_active) WHERE id = ?',
        [name, role, department, email, is_active, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
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
    if ((result as ResultSetHeader).affectedRows === 0) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

export default router;
