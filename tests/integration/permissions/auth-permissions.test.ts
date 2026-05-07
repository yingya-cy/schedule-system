import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createAppWithAuth, loginAs, createTestUser } from '../../helpers/testServer';

describe('Auth Permissions', () => {
  let app: ReturnType<typeof createAppWithAuth>;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let testUserId: number;

  beforeAll(async () => {
    app = createAppWithAuth();
    adminToken = (await loginAs(app, 'admin', 'admin123')).token;

    await createTestUser(app, adminToken, { username: 'ap_teach', name: '认证教师', password: 'test123', role: 'teacher' });
    await createTestUser(app, adminToken, { username: 'ap_stu', name: '认证学生', password: 'test123', role: 'student' });

    teacherToken = (await loginAs(app, 'ap_teach', 'test123')).token;
    studentToken = (await loginAs(app, 'ap_stu', 'test123')).token;

    testUserId = await createTestUser(app, adminToken, { username: 'ap_target', name: '目标用户', password: 'test123', role: 'teacher' });
  });

  afterAll(async () => {
    if (testUserId) {
      await supertest(app)
        .delete(`/api/auth/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });

  // ---- 401 ----
  describe('Authentication (401)', () => {
    it('should return 401 for GET /users without token', async () => {
      await supertest(app).get('/api/auth/users').expect(401);
    });
    it('should return 401 for POST /users without token', async () => {
      await supertest(app).post('/api/auth/users').send({ username: 'x', name: 'x', password: 'x' }).expect(401);
    });
    it('should return 401 for PUT /users/:id without token', async () => {
      await supertest(app).put(`/api/auth/users/${testUserId}`).send({ name: 'x' }).expect(401);
    });
    it('should return 401 for DELETE /users/:id without token', async () => {
      await supertest(app).delete(`/api/auth/users/${testUserId}`).expect(401);
    });
    it('should return 401 for PUT reset-password without token', async () => {
      await supertest(app).put(`/api/auth/users/${testUserId}/reset-password`).send({ password: 'new' }).expect(401);
    });
  });

  // ---- 403: non-admin ----
  describe('Authorization (403) for non-admin', () => {
    it('should return 403 when teacher tries GET /users', async () => {
      await supertest(app).get('/api/auth/users').set('Authorization', `Bearer ${teacherToken}`).expect(403);
    });
    it('should return 403 when teacher tries POST /users', async () => {
      await supertest(app).post('/api/auth/users').set('Authorization', `Bearer ${teacherToken}`).send({ username: 'x1', name: 'x', password: 'x' }).expect(403);
    });
    it('should return 403 when teacher tries PUT /users/:id', async () => {
      await supertest(app).put(`/api/auth/users/${testUserId}`).set('Authorization', `Bearer ${teacherToken}`).send({ name: 'x' }).expect(403);
    });
    it('should return 403 when teacher tries DELETE /users/:id', async () => {
      await supertest(app).delete(`/api/auth/users/${testUserId}`).set('Authorization', `Bearer ${teacherToken}`).expect(403);
    });
    it('should return 403 when teacher tries PUT reset-password', async () => {
      await supertest(app).put(`/api/auth/users/${testUserId}/reset-password`).set('Authorization', `Bearer ${teacherToken}`).send({ password: 'new' }).expect(403);
    });
    it('should return 403 when student tries GET /users', async () => {
      await supertest(app).get('/api/auth/users').set('Authorization', `Bearer ${studentToken}`).expect(403);
    });
    it('should return 403 when student tries POST /users', async () => {
      await supertest(app).post('/api/auth/users').set('Authorization', `Bearer ${studentToken}`).send({ username: 'x2', name: 'x', password: 'x' }).expect(403);
    });
  });

  // ---- 200: admin ----
  describe('Admin access (200)', () => {
    it('should allow admin to GET /users', async () => {
      await supertest(app).get('/api/auth/users').set('Authorization', `Bearer ${adminToken}`).expect(200);
    });
    it('should allow admin to POST /users', async () => {
      const res = await supertest(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'ap_new', name: '新用户', password: 'test123', role: 'teacher' })
        .expect(200);
      await supertest(app).delete(`/api/auth/users/${res.body.data.id}`).set('Authorization', `Bearer ${adminToken}`);
    });
    it('should allow admin to PUT /users/:id', async () => {
      await supertest(app).put(`/api/auth/users/${testUserId}`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'renamed' }).expect(200);
    });
  });
});
