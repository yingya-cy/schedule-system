import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../../src/middleware/auth.ts';
import authRouter from '../../src/routes/auth.ts';
import scoringRouter from '../../src/routes/scoring.ts';
import fileCenterRouter from '../../src/routes/file-center.ts';
import termsRouter from '../../src/routes/terms.ts';
import scheduleService from '../../src/services/scheduleService.ts';
import queryService from '../../src/services/queryService.ts';
import excelExportService from '../../src/services/excelExportService.ts';

const upload = multer({ storage: multer.memoryStorage() });

function registerRoutes(app: express.Express) {
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

  app.get('/api/departments', async (req, res) => {
    try {
      const departments = await scheduleService.getAllDepartments();
      res.json({ success: true, data: departments });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/schedules', async (req, res) => {
    try {
      const pool = (await import('../../src/config/database.ts')).default;
      const { department, name, term_id } = req.query;
      let termId = term_id ? parseInt(term_id as string) : undefined;
      if (!termId) {
        const [terms] = await pool.query("SELECT id FROM terms WHERE status = 'active' LIMIT 1");
        termId = (terms as any[])[0]?.id;
      }
      const schedules = await scheduleService.getAllSchedules({
        department: department as string,
        name: name as string,
        term_id: termId,
      });
      res.json({ success: true, data: schedules });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/schedules/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schedule = await scheduleService.getScheduleWithCourses(id);
      if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });
      res.json({ success: true, data: schedule });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/schedules', async (req, res) => {
    try {
      const schedule = await scheduleService.createSchedule(req.body);
      res.json({ success: true, data: schedule });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/schedules/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schedule = await scheduleService.updateSchedule(id, req.body);
      if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });
      res.json({ success: true, data: schedule });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/schedules/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await scheduleService.deleteSchedule(id);
      res.json({ success: true, deleted: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/schedules/:scheduleId/courses', async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      const course = await scheduleService.createCourse(scheduleId, req.body);
      res.json({ success: true, data: course });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/courses/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const course = await scheduleService.updateCourse(id, req.body);
      res.json({ success: true, data: course });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/courses/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await scheduleService.deleteCourse(id);
      res.json({ success: true, deleted: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/query/free-time', async (req, res) => {
    try {
      const { week, day, section, department, name } = req.query;
      const results = await queryService.queryFreeTime({
        week: week ? parseInt(week as string) : undefined,
        day: day ? parseInt(day as string) : undefined,
        section: section ? parseInt(section as string) : undefined,
        department: department as string,
        name: name as string,
      });
      res.json({ success: true, data: results });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/query/person-schedule', async (req, res) => {
    try {
      const { name } = req.query;
      if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
      const result = await queryService.getPersonSchedule(name as string);
      if (!result) return res.status(404).json({ success: false, error: 'Person not found' });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/query/department-stats', async (req, res) => {
    try {
      const { department } = req.query;
      if (!department) return res.status(400).json({ success: false, error: 'Department is required' });
      const result = await queryService.getDepartmentStats(department as string);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/query/all-free-time', async (req, res) => {
    try {
      const result = await queryService.getAllFreeTimeData();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/contacts', async (req, res) => {
    try {
      const { department } = req.query;
      let sql = 'SELECT id, username, name, role, department, avatar_url, email FROM users WHERE is_active = 1';
      const params: any[] = [];
      if (department) { sql += ' AND department = ?'; params.push(department); }
      sql += ' ORDER BY role, name LIMIT 200';
      const pool = (await import('../../src/config/database.ts')).default;
      const [rows] = await pool.query(sql, params);
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const pool = (await import('../../src/config/database.ts')).default;
      const [[schedCount], [courseCount], [userCount], [deptCount], [fileCount]] = await Promise.all([
        pool.query('SELECT COUNT(*) as total FROM schedules'),
        pool.query('SELECT COUNT(*) as total FROM courses'),
        pool.query('SELECT COUNT(*) as total FROM users WHERE is_active = 1'),
        pool.query('SELECT COUNT(*) as total FROM departments'),
        pool.query('SELECT COUNT(*) as total FROM file_items'),
      ]);
      res.json({
        success: true,
        data: {
          schedules: (schedCount as any[])[0].total,
          courses: (courseCount as any[])[0].total,
          users: (userCount as any[])[0].total,
          departments: (deptCount as any[])[0].total,
          files: (fileCount as any[])[0].total,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/export/reverse-schedule', async (req, res) => {
    try {
      const pool = (await import('../../src/config/database.ts')).default;
      const data = await queryService.getAllFreeTimeData();
      const [terms] = await pool.query("SELECT name FROM terms WHERE status = 'active' LIMIT 1");
      const termName = (terms as any[])[0]?.name || '';
      const wb = await excelExportService.generateReverseScheduleWorkbook(data, termName);
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reverse-schedule.xlsx');
      res.send(Buffer.from(buf));
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

export function createApp(): express.Express {
  const app = express();
  registerRoutes(app);
  return app;
}

export function createAppWithAuth(): express.Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: '请求过于频繁，请稍后再试' },
  });
  app.use('/api', apiLimiter);

  // Auth middleware mounts (mirrors server.ts)
  app.use('/api/schedules', authenticate);
  app.use('/api/query', authenticate);
  app.use('/api/export', authenticate);
  app.use('/api/dashboard', authenticate);
  app.use('/api/contacts', authenticate);

  app.use('/api/auth', authRouter);
  app.use('/api/scoring', scoringRouter);
  app.use('/api/file-center', fileCenterRouter);
  app.use('/api/terms', termsRouter);

  app.get('/api/departments', async (req, res) => {
    try {
      const departments = await scheduleService.getAllDepartments();
      res.json({ success: true, data: departments });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

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

  app.get('/api/schedules', async (req, res) => {
    try {
      const pool = (await import('../../src/config/database.ts')).default;
      const { department, name, term_id } = req.query;
      let termId = term_id ? parseInt(term_id as string) : undefined;
      if (!termId) {
        const [terms] = await pool.query("SELECT id FROM terms WHERE status = 'active' LIMIT 1");
        termId = (terms as any[])[0]?.id;
      }
      const schedules = await scheduleService.getAllSchedules({
        department: department as string,
        name: name as string,
        term_id: termId,
      });
      res.json({ success: true, data: schedules });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/schedules/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schedule = await scheduleService.getScheduleWithCourses(id);
      if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });
      res.json({ success: true, data: schedule });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/schedules', async (req, res) => {
    try {
      const schedule = await scheduleService.createSchedule({
        ...req.body,
        created_by: req.user!.username,
      });
      res.json({ success: true, data: schedule });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/schedules/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { role, username, department } = req.user!;
      const existing = await scheduleService.getScheduleWithCourses(id);
      if (!existing) return res.status(404).json({ success: false, error: 'Schedule not found' });

      const isPrivileged = role === 'admin' || department === '秘书部' || department === '主任团';
      const isCreator = (existing as any).created_by === username;
      if (!isPrivileged && !isCreator) {
        return res.status(403).json({ success: false, error: '没有权限修改此课表' });
      }

      const schedule = await scheduleService.updateSchedule(id, req.body);
      res.json({ success: true, data: schedule });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/schedules/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { role, username, department } = req.user!;
      const existing = await scheduleService.getScheduleWithCourses(id);
      if (!existing) return res.status(404).json({ success: false, error: 'Schedule not found' });

      const isPrivileged = role === 'admin' || department === '秘书部' || department === '主任团';
      const isCreator = (existing as any).created_by === username;
      if (!isPrivileged && !isCreator) {
        return res.status(403).json({ success: false, error: '没有权限删除此课表' });
      }

      await scheduleService.deleteSchedule(id);
      res.json({ success: true, deleted: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/schedules/:scheduleId/courses', async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      const course = await scheduleService.createCourse(scheduleId, req.body);
      res.json({ success: true, data: course });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/courses/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const course = await scheduleService.updateCourse(id, req.body);
      res.json({ success: true, data: course });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/courses/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await scheduleService.deleteCourse(id);
      res.json({ success: true, deleted: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/query/free-time', async (req, res) => {
    try {
      const { week, day, section, department, name } = req.query;
      const results = await queryService.queryFreeTime({
        week: week ? parseInt(week as string) : undefined,
        day: day ? parseInt(day as string) : undefined,
        section: section ? parseInt(section as string) : undefined,
        department: department as string,
        name: name as string,
      });
      res.json({ success: true, data: results });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/query/person-schedule', async (req, res) => {
    try {
      const { name } = req.query;
      if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
      const result = await queryService.getPersonSchedule(name as string);
      if (!result) return res.status(404).json({ success: false, error: 'Person not found' });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/query/department-stats', async (req, res) => {
    try {
      const { department } = req.query;
      if (!department) return res.status(400).json({ success: false, error: 'Department is required' });
      const result = await queryService.getDepartmentStats(department as string);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/query/all-free-time', async (req, res) => {
    try {
      const result = await queryService.getAllFreeTimeData();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/contacts', async (req, res) => {
    try {
      const { department } = req.query;
      let sql = 'SELECT id, username, name, role, department, avatar_url, email FROM users WHERE is_active = 1';
      const params: any[] = [];
      if (department) { sql += ' AND department = ?'; params.push(department); }
      sql += ' ORDER BY role, name LIMIT 200';
      const pool = (await import('../../src/config/database.ts')).default;
      const [rows] = await pool.query(sql, params);
      res.json({ success: true, data: rows });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const pool = (await import('../../src/config/database.ts')).default;
      const [[schedCount], [courseCount], [userCount], [deptCount], [fileCount]] = await Promise.all([
        pool.query('SELECT COUNT(*) as total FROM schedules'),
        pool.query('SELECT COUNT(*) as total FROM courses'),
        pool.query('SELECT COUNT(*) as total FROM users WHERE is_active = 1'),
        pool.query('SELECT COUNT(*) as total FROM departments'),
        pool.query('SELECT COUNT(*) as total FROM file_items'),
      ]);
      res.json({
        success: true,
        data: {
          schedules: (schedCount as any[])[0].total,
          courses: (courseCount as any[])[0].total,
          users: (userCount as any[])[0].total,
          departments: (deptCount as any[])[0].total,
          files: (fileCount as any[])[0].total,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/export/reverse-schedule', async (req, res) => {
    try {
      const pool = (await import('../../src/config/database.ts')).default;
      const data = await queryService.getAllFreeTimeData();
      const [terms] = await pool.query("SELECT name FROM terms WHERE status = 'active' LIMIT 1");
      const termName = (terms as any[])[0]?.name || '';
      const wb = await excelExportService.generateReverseScheduleWorkbook(data, termName);
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reverse-schedule.xlsx');
      res.send(Buffer.from(buf));
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
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
