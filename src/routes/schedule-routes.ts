import { Express } from 'express';
import pool from '../config/database.ts';
import scheduleService from '../services/scheduleService.ts';
import queryService from '../services/queryService.ts';
import excelExportService from '../services/excelExportService.ts';
import { sendError } from '../utils/errorHandler.ts';
import { validate, createScheduleSchema, updateScheduleSchema, createCourseSchema, updateCourseSchema } from '../utils/validation.ts';

export function registerScheduleRoutes(app: Express) {
  app.get('/api/departments', async (req, res) => {
    try {
      const departments = await scheduleService.getAllDepartments();
      res.json({ success: true, data: departments });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/schedules', async (req, res) => {
    try {
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
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/schedules/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schedule = await scheduleService.getScheduleWithCourses(id);
      if (!schedule) {
        res.status(404).json({ success: false, error: 'Schedule not found' });
        return;
      }
      res.json({ success: true, data: schedule });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/schedules/:id/files', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [rows] = await pool.query(
        'SELECT * FROM file_items WHERE schedule_id = ? ORDER BY created_at DESC',
        [id]
      );
      res.json({ success: true, data: rows });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/schedules/:id/file', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const download = req.query.download === 'true';
      const fileData = await scheduleService.getScheduleFile(id);
      if (!fileData) {
        res.status(404).json({ success: false, error: 'File not found' });
        return;
      }
      res.setHeader('Content-Type', fileData.file_type);
      const disposition = download ? 'attachment' : 'inline';
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(fileData.filename)}"`);
      res.send(fileData.file_data);
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.post('/api/schedules', validate(createScheduleSchema), async (req, res) => {
    try {
      const schedule = await scheduleService.createSchedule({
        ...req.body,
        created_by: req.user?.username || req.body.created_by,
      });
      res.json({ success: true, data: schedule });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.put('/api/schedules/:id', validate(updateScheduleSchema), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await scheduleService.getScheduleById(id);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Schedule not found' });
        return;
      }
      if (req.user) {
        const { role, username, department } = req.user;
        const isPrivileged = role === 'admin' || department === '秘书部' || department === '主任团';
        const isCreator = (existing as any).created_by === username;
        if (!isPrivileged && !isCreator) {
          res.status(403).json({ success: false, error: '无权编辑此课表' });
          return;
        }
      }
      const schedule = await scheduleService.updateSchedule(id, req.body);
      res.json({ success: true, data: schedule });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.delete('/api/schedules/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await scheduleService.getScheduleById(id);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Schedule not found' });
        return;
      }
      if (req.user) {
        const { role, username, department } = req.user;
        const isPrivileged = role === 'admin' || department === '秘书部' || department === '主任团';
        const isCreator = (existing as any).created_by === username;
        if (!isPrivileged && !isCreator) {
          res.status(403).json({ success: false, error: '无权删除此课表' });
          return;
        }
      }
      const deleted = await scheduleService.deleteSchedule(id);
      res.json({ success: true, deleted });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.post('/api/schedules/:scheduleId/courses', validate(createCourseSchema), async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      const course = await scheduleService.createCourse(scheduleId, req.body);
      res.json({ success: true, data: course });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.put('/api/courses/:id', validate(updateCourseSchema), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const course = await scheduleService.updateCourse(id, req.body);
      if (!course) {
        res.status(404).json({ success: false, error: 'Course not found' });
        return;
      }
      res.json({ success: true, data: course });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.delete('/api/courses/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await scheduleService.deleteCourse(id);
      res.json({ success: true, deleted });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/query/free-time', async (req, res) => {
    try {
      const { week, day, section, department, name, term_id } = req.query;
      let termId = term_id ? parseInt(term_id as string) : undefined;
      if (!termId) {
        const [terms] = await pool.query("SELECT id FROM terms WHERE status = 'active' LIMIT 1");
        termId = (terms as any[])[0]?.id;
      }
      const results = await queryService.queryFreeTime({
        week: week ? parseInt(week as string) : undefined,
        day: day ? parseInt(day as string) : undefined,
        section: section ? parseInt(section as string) : undefined,
        department: department as string,
        name: name as string,
        term_id: termId,
      });
      res.json({ success: true, data: results });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/query/person-schedule', async (req, res) => {
    try {
      const { name } = req.query;
      if (!name) {
        res.status(400).json({ success: false, error: 'Name parameter is required' });
        return;
      }
      const result = await queryService.getPersonSchedule(name as string);
      if (!result) {
        res.status(404).json({ success: false, error: 'Person not found' });
        return;
      }
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/query/department-stats', async (req, res) => {
    try {
      const { department } = req.query;
      if (!department) {
        res.status(400).json({ success: false, error: 'Department parameter is required' });
        return;
      }
      const result = await queryService.getDepartmentStats(department as string);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/query/all-free-time', async (req, res) => {
    try {
      const result = await queryService.getAllFreeTimeData();
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.post('/api/export/reverse-schedule', async (req, res) => {
    try {
      const { term_id } = req.body as { term_id?: number };
      const data = await queryService.getAllFreeTimeData(term_id);
      const [terms] = await pool.query(
        term_id ? 'SELECT name FROM terms WHERE id = ?' : "SELECT name FROM terms WHERE status = 'active' LIMIT 1",
        term_id ? [term_id] : []
      );
      const termName = (terms as any[])[0]?.name || '';
      const wb = await excelExportService.generateReverseScheduleWorkbook(data, termName);
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reverse-schedule.xlsx');
      res.send(Buffer.from(buf));
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.post('/api/export/person-schedule', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        res.status(400).json({ success: false, error: 'Name parameter is required' });
        return;
      }
      const result = await queryService.getPersonSchedule(name);
      if (!result) {
        res.status(404).json({ success: false, error: 'Person not found' });
        return;
      }
      const excelBuffer = await excelExportService.generatePersonScheduleExcel(name, result.all_courses);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${name}-schedule.xlsx`);
      res.send(excelBuffer);
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.post('/api/export/department-stats', async (req, res) => {
    try {
      const { department } = req.body;
      if (!department) {
        res.status(400).json({ success: false, error: 'Department parameter is required' });
        return;
      }
      const result = await queryService.getDepartmentStats(department);
      const excelBuffer = await excelExportService.generateDepartmentStatsExcel(department, result.schedules);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${department}-stats.xlsx`);
      res.send(excelBuffer);
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const { term_id } = req.query;
      let termId = term_id ? parseInt(term_id as string) : undefined;
      if (!termId) {
        const [terms] = await pool.query("SELECT id FROM terms WHERE status = 'active' LIMIT 1");
        termId = (terms as any[])[0]?.id;
      }
      const [[schedCount], [courseCount], [userCount], [deptCount], [fileCount]] = await Promise.all([
        pool.query('SELECT COUNT(*) as total FROM schedules WHERE term_id = ?', [termId]),
        pool.query('SELECT COUNT(*) as total FROM courses c JOIN schedules s ON c.schedule_id = s.id WHERE s.term_id = ?', [termId]),
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
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/courses', async (req, res) => {
    try {
      const { category } = req.query;
      let sql = `SELECT c.*, s.name as schedule_name, s.department
                 FROM courses c JOIN schedules s ON c.schedule_id = s.id`;
      const params: any[] = [];
      if (category) {
        sql += ' WHERE s.department = ?';
        params.push(category);
      }
      sql += ' ORDER BY c.weekday ASC, c.id DESC LIMIT 200';
      const [rows] = await pool.query(sql, params);
      res.json({ success: true, data: rows });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });

  app.get('/api/contacts', async (req, res) => {
    try {
      const { department } = req.query;
      let sql = 'SELECT id, username, name, role, department, avatar_url, email FROM users WHERE is_active = 1';
      const params: any[] = [];
      if (department) { sql += ' AND department = ?'; params.push(department); }
      sql += ' ORDER BY role, name LIMIT 200';
      const [rows] = await pool.query(sql, params);
      res.json({ success: true, data: rows });
    } catch (error: unknown) {
      sendError(res, error);
    }
  });
}
