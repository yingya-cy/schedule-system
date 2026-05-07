import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createApp, loginAs } from '../../helpers/testServer';

describe('Auth Register', () => {
  let app: ReturnType<typeof createApp>;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();
    adminToken = (await loginAs(app, 'admin', 'admin123')).token;
  });

  // ---- Register ----
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ username: 'regtest1', email: 'regtest1@test.com', name: 'Tests', password: 'test123' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject duplicate username', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ username: 'regtest1', email: 'regtest1@test.com', name: 'Tests', password: 'test123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/注册|存在/);
    });

    it('should reject missing fields', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ username: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject short password', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ username: 'x1', email: 'x@t.com', name: 'X', password: '12345' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/至少6位/);
    });

    it('should reject invalid email format', async () => {
      const res = await supertest(app)
        .post('/api/auth/register')
        .send({ username: 'x2', email: 'notanemail', name: 'X', password: '123456' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/邮箱格式/);
    });
  });

  // ---- Verify Email ----
  describe('GET /api/auth/verify-email', () => {
    it('should reject empty token', async () => {
      const res = await supertest(app).get('/api/auth/verify-email');
      expect(res.status).toBe(400);
    });

    it('should reject invalid token', async () => {
      const res = await supertest(app).get('/api/auth/verify-email?token=invalid');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/无效|过期/);
    });
  });

  // ---- Verify Email Resend ----
  describe('POST /api/auth/verify-email/resend', () => {
    it('should reject empty email', async () => {
      const res = await supertest(app).post('/api/auth/verify-email/resend').send({});
      expect(res.status).toBe(400);
    });

    it('should handle unregistered email', async () => {
      const res = await supertest(app)
        .post('/api/auth/verify-email/resend')
        .send({ email: 'nonexistent@test.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/未注册/);
    });
  });

  // ---- Login rejection for unverified ----
  describe('Login rejection for unverified accounts', () => {
    it('should reject login for registered but unverified user', async () => {
      // regtest1 was registered but not verified (no email sent in test mode)
      const res = await supertest(app)
        .post('/api/auth/login')
        .send({ username: 'regtest1', password: 'test123' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/验证/);
    });
  });

  // ---- Cleanup ----
  describe('Cleanup', () => {
    it('should clean up test user', async () => {
      // Find and delete regtest1
      const listRes = await supertest(app)
        .get('/api/auth/users?search=regtest1')
        .set('Authorization', `Bearer ${adminToken}`);
      if (listRes.body?.data?.length > 0) {
        for (const u of listRes.body.data) {
          if (u.username === 'regtest1') {
            await supertest(app)
              .delete(`/api/auth/users/${u.id}`)
              .set('Authorization', `Bearer ${adminToken}`);
          }
        }
      }
    });
  });
});
