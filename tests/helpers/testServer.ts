import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../../src/middleware/auth.ts';
import authRouter from '../../src/routes/auth.ts';
import scoringRouter from '../../src/routes/scoring/index.ts';
import fileCenterRouter from '../../src/routes/file-center/index.ts';
import termsRouter from '../../src/routes/terms.ts';
import psychologyRouter from '../../src/routes/psychology/index.ts';
import { registerScheduleRoutes } from '../../src/routes/schedule-routes.ts';

const upload = multer({ storage: multer.memoryStorage() });

function setupBase(app: express.Express) {
  app.use(express.json({ limit: '10mb' }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: '请求过于频繁，请稍后再试' },
  });
  app.use('/api', apiLimiter);

  app.use('/api/auth', authRouter);
  app.use('/api/scoring', scoringRouter);
  app.use('/api/file-center', fileCenterRouter);
  app.use('/api/terms', termsRouter);
  app.use('/api/psychology', psychologyRouter);
}

export function createApp(): express.Express {
  const app = express();
  setupBase(app);
  registerScheduleRoutes(app);
  return app;
}

export function createAppWithAuth(): express.Express {
  const app = express();
  setupBase(app);

  // Auth middleware MUST be before schedule routes
  app.use('/api/schedules', authenticate);
  app.use('/api/query', authenticate);
  app.use('/api/export', authenticate);
  app.use('/api/dashboard', authenticate);
  app.use('/api/contacts', authenticate);

  registerScheduleRoutes(app);

  app.get('/api/reset-departments', authenticate, requireRole('admin'), async (req, res) => {
    let connection = null;
    try {
      const pool = (await import('../../src/config/database.ts')).default;
      connection = await pool.getConnection();
      await connection.query('DELETE FROM departments');
      await connection.query(`
        INSERT INTO departments (name, sort_order) VALUES
        ('主任团', 1), ('网编部', 2), ('秘书部', 3),
        ('策划部', 4), ('咨询部', 5), ('外联部', 6), ('宣传部', 7)
      `);
      res.json({ success: true, message: '部门数据已重置' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    } finally {
      if (connection) connection.release();
    }
  });

  return app;
}

export async function loginAs(
  app: express.Express,
  username: string,
  password: string
): Promise<{ token: string; userId: number }> {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app)
    .post('/api/auth/login')
    .send({ username, password })
    .expect(200);
  return { token: res.body.data.token, userId: res.body.data.user.id };
}

export async function createTestUser(
  app: express.Express,
  adminToken: string,
  user: { username: string; name: string; password: string; role?: string; department?: string }
) {
  const supertest = (await import('supertest')).default;

  // Delete existing user with same username if exists
  const existing = await supertest(app)
    .get('/api/auth/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .query({ search: user.username });

  const existingUsers = existing.body?.data;
  if (Array.isArray(existingUsers)) {
    for (const u of existingUsers) {
      if (u.username === user.username) {
        await supertest(app)
          .delete(`/api/auth/users/${u.id}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    }
  }

  const res = await supertest(app)
    .post('/api/auth/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      username: user.username,
      name: user.name,
      password: user.password,
      role: user.role || 'teacher',
      department: user.department || null,
    })
    .expect(200);
  return res.body.data.id;
}
