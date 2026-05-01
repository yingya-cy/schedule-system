import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import authRouter from '../../src/routes/auth.ts';
import scoringRouter from '../../src/routes/scoring.ts';
import fileCenterRouter from '../../src/routes/file-center.ts';
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
      const { department, name } = req.query;
      const schedules = await scheduleService.getAllSchedules({
        department: department as string,
        name: name as string,
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
      const data = await queryService.getAllFreeTimeData();
      const excelBuffer = excelExportService.generateReverseScheduleExcel(data);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reverse-schedule.xlsx');
      res.send(excelBuffer);
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
  user: { username: string; name: string; password: string; role?: string }
) {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app)
    .post('/api/auth/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: user.username, name: user.name, password: user.password, role: user.role || 'teacher' })
    .expect(200);
  return res.body.data.id;
}
