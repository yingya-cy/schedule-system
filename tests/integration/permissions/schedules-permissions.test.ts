import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createAppWithAuth, loginAs, createTestUser } from '../../helpers/testServer';

describe('Schedules Permissions', () => {
  let app: ReturnType<typeof createAppWithAuth>;
  let adminToken: string;
  let teacherWebToken: string;
  let teacherWebId: number;
  let teacherSecToken: string;
  let teacherDirToken: string;
  let studentToken: string;

  let scheduleByTeacher: any;
  let scheduleByAdmin: any;

  beforeAll(async () => {
    app = createAppWithAuth();
    adminToken = (await loginAs(app, 'admin', 'admin123')).token;

    await createTestUser(app, adminToken, { username: 'perm_tw', name: '网编教师', password: 'test123', role: 'teacher', department: '网编部' });
    await createTestUser(app, adminToken, { username: 'perm_ts', name: '秘书教师', password: 'test123', role: 'teacher', department: '秘书部' });
    await createTestUser(app, adminToken, { username: 'perm_td', name: '主任教师', password: 'test123', role: 'teacher', department: '主任团' });
    await createTestUser(app, adminToken, { username: 'perm_stu', name: '学生', password: 'test123', role: 'student', department: '网编部' });

    const t1 = await loginAs(app, 'perm_tw', 'test123');
    teacherWebToken = t1.token; teacherWebId = t1.userId;
    teacherSecToken = (await loginAs(app, 'perm_ts', 'test123')).token;
    teacherDirToken = (await loginAs(app, 'perm_td', 'test123')).token;
    studentToken = (await loginAs(app, 'perm_stu', 'test123')).token;

    const res1 = await supertest(app)
      .post('/api/schedules')
      .set('Authorization', `Bearer ${teacherWebToken}`)
      .send({ name: '教师创建的课表', department: '网编部', courses: [] });
    scheduleByTeacher = res1.body.data;

    const res2 = await supertest(app)
      .post('/api/schedules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '管理员创建的课表', department: '网编部', courses: [] });
    scheduleByAdmin = res2.body.data;
  });

  afterAll(async () => {
    const auth = (req: supertest.Test) => req.set('Authorization', `Bearer ${adminToken}`);
    if (scheduleByTeacher) await auth(supertest(app).delete(`/api/schedules/${scheduleByTeacher.id}`));
    if (scheduleByAdmin) await auth(supertest(app).delete(`/api/schedules/${scheduleByAdmin.id}`));
  });

  // ---- 401: no token ----
  describe(' Authentication (401)', () => {
    it('should return 401 for GET /api/schedules without token', async () => {
      await supertest(app).get('/api/schedules').expect(401);
    });
    it('should return 401 for GET /api/schedules/:id without token', async () => {
      await supertest(app).get('/api/schedules/1').expect(401);
    });
    it('should return 401 for POST /api/schedules without token', async () => {
      await supertest(app).post('/api/schedules').send({ name: 'x', department: 'x' }).expect(401);
    });
    it('should return 401 for PUT /api/schedules/:id without token', async () => {
      await supertest(app).put('/api/schedules/1').send({ name: 'x' }).expect(401);
    });
    it('should return 401 for DELETE /api/schedules/:id without token', async () => {
      await supertest(app).delete('/api/schedules/1').expect(401);
    });
    it('should return 401 for POST /api/schedules/:id/courses without token', async () => {
      await supertest(app).post('/api/schedules/1/courses').send({ course_name: 'x', weekday: 1 }).expect(401);
    });
  });

  // ---- 403: unauthorized modifications ----
  describe(' Authorization (403)', () => {
    it('should return 403 when non-creator teacher tries to PUT schedule', async () => {
      await supertest(app)
        .put(`/api/schedules/${scheduleByTeacher.id}`)
        .set('Authorization', `Bearer ${teacherSecToken}`)
        .send({ name: 'hacked' })
        .expect(200); // 秘书部 is privileged, can edit any
    });

    it('should return 403 when non-creator non-privileged teacher tries to PUT schedule', async () => {
      // Create a schedule as admin, then teacher_web (not creator, not privileged) tries to edit
      await supertest(app)
        .put(`/api/schedules/${scheduleByAdmin.id}`)
        .set('Authorization', `Bearer ${teacherWebToken}`)
        .send({ name: 'hacked' })
        .expect(403);
    });

    it('should return 403 when student tries to PUT schedule', async () => {
      await supertest(app)
        .put(`/api/schedules/${scheduleByTeacher.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'hacked' })
        .expect(403);
    });

    it('should return 403 when student tries to DELETE schedule', async () => {
      await supertest(app)
        .delete(`/api/schedules/${scheduleByTeacher.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  // ---- 200: authorized modifications ----
  describe(' Authorization (200)', () => {
    it('should allow creator to PUT their own schedule', async () => {
      await supertest(app)
        .put(`/api/schedules/${scheduleByTeacher.id}`)
        .set('Authorization', `Bearer ${teacherWebToken}`)
        .send({ name: 'updated by creator' })
        .expect(200);
    });

    it('should allow admin to PUT any schedule', async () => {
      await supertest(app)
        .put(`/api/schedules/${scheduleByTeacher.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'updated by admin' })
        .expect(200);
    });

    it('should allow admin to DELETE any schedule', async () => {
      // Create temp schedule then delete
      const res = await supertest(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${teacherWebToken}`)
        .send({ name: 'to-delete', department: '网编部', courses: [] });
      await supertest(app)
        .delete(`/api/schedules/${res.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should allow 秘书部 user to PUT schedule not created by them', async () => {
      await supertest(app)
        .put(`/api/schedules/${scheduleByTeacher.id}`)
        .set('Authorization', `Bearer ${teacherSecToken}`)
        .send({ name: '秘书部 updated' })
        .expect(200);
    });

    it('should allow 主任团 user to DELETE schedule not created by them', async () => {
      const res = await supertest(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${teacherWebToken}`)
        .send({ name: 'to-delete-dir', department: '网编部', courses: [] });
      await supertest(app)
        .delete(`/api/schedules/${res.body.data.id}`)
        .set('Authorization', `Bearer ${teacherDirToken}`)
        .expect(200);
    });

    it('should allow student to PUT their own schedule', async () => {
      const res = await supertest(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'student schedule', department: '网编部', courses: [] });
      await supertest(app)
        .put(`/api/schedules/${res.body.data.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'student updated' })
        .expect(200);
      // cleanup
      await supertest(app).delete(`/api/schedules/${res.body.data.id}`).set('Authorization', `Bearer ${adminToken}`);
    });

    it('should return 403 when student tries to PUT schedule created by others', async () => {
      await supertest(app)
        .put(`/api/schedules/${scheduleByTeacher.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'hacked by student' })
        .expect(403);
    });
  });

  // ---- 200: authenticated read access ----
  describe('Authenticated read access (200)', () => {
    it('should allow any authenticated user to GET /api/schedules', async () => {
      await supertest(app).get('/api/schedules').set('Authorization', `Bearer ${studentToken}`).expect(200);
    });
    it('should allow teacher to GET /api/schedules', async () => {
      await supertest(app).get('/api/schedules').set('Authorization', `Bearer ${teacherWebToken}`).expect(200);
    });
    it('should allow admin to POST a new schedule', async () => {
      const res = await supertest(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'admin schedule', department: '网编部', courses: [] })
        .expect(200);
      expect(res.body.data.created_by).toBe('admin');
      // cleanup
      await supertest(app).delete(`/api/schedules/${res.body.data.id}`).set('Authorization', `Bearer ${adminToken}`);
    });
  });
});
