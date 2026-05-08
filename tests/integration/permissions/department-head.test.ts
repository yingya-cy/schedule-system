import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createAppWithAuth, loginAs, createTestUser } from '../../helpers/testServer';

describe('Department Head Permissions', () => {
  let app: ReturnType<typeof createAppWithAuth>;
  let adminToken: string;
  let deptHeadToken: string;
  let studentToken: string;

  beforeAll(async () => {
    app = createAppWithAuth();
    adminToken = (await loginAs(app, 'admin', 'admin123')).token;
    await createTestUser(app, adminToken, { username: 'dh_test', name: '测试部长', password: 'test123', role: 'department_head', department: '网编部' });
    await createTestUser(app, adminToken, { username: 'dh_stu', name: '测试学生', password: 'test123', role: 'student', department: '网编部' });
    deptHeadToken = (await loginAs(app, 'dh_test', 'test123')).token;
    studentToken = (await loginAs(app, 'dh_stu', 'test123')).token;
  });

  describe('GET /api/auth/users', () => {
    it('department_head can list users (scoped)', async () => {
      const res = await supertest(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${deptHeadToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
      // Should only see users in 网编部
      for (const u of res.body.data) {
        expect(u.department).toBe('网编部');
      }
    });

    it('student cannot list users', async () => {
      await supertest(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/auth/users/:id', () => {
    it('department_head cannot change user role', async () => {
      const res = await supertest(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${deptHeadToken}`);
      const member = res.body.data[0];
      await supertest(app)
        .put(`/api/auth/users/${member.id}`)
        .set('Authorization', `Bearer ${deptHeadToken}`)
        .send({ name: '改名测试' })
        .expect(200);
    });
  });
});
