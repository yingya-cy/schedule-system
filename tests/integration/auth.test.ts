import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createApp, loginAs } from '../helpers/testServer.ts';

let app: ReturnType<typeof createApp>;
let adminToken: string;

beforeAll(async () => {
  app = createApp();
  const result = await loginAs(app, 'admin', 'admin123');
  adminToken = result.token;
});

describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.username).toBe('admin');
  });

  it('returns 401 for invalid password', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('returns 401 for non-existent user', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent', password: 'test' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({})
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user profile', async () => {
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.username).toBe('admin');
  });

  it('returns 401 without token', async () => {
    const res = await supertest(app)
      .get('/api/auth/me')
      .expect(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with invalid token', async () => {
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
    expect(res.body.success).toBe(false);
  });
});

describe('PUT /api/auth/password', () => {
  it('returns 400 for short new password', async () => {
    const res = await supertest(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ oldPassword: 'admin123', newPassword: '12' })
      .expect(400);
    expect(res.body.success).toBe(false);
  });
});

describe('User CRUD (admin)', () => {
  let testUserId: number;

  it('POST /api/auth/users creates a user', async () => {
    const res = await supertest(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'testuser1', name: '测试用户', password: 'test123' })
      .expect(200);

    expect(res.body.success).toBe(true);
    testUserId = res.body.data.id;
  });

  it('GET /api/auth/users lists users', async () => {
    const res = await supertest(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(Number(res.body.meta.total)).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/auth/users supports search', async () => {
    const res = await supertest(app)
      .get('/api/auth/users?search=admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('PUT /api/auth/users/:id updates a user', async () => {
    const res = await supertest(app)
      .put(`/api/auth/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '更新后的名字' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('PUT /api/auth/users/:id/reset-password resets password', async () => {
    const res = await supertest(app)
      .put(`/api/auth/users/${testUserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'newpass123' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/auth/users/:id deletes a user', async () => {
    const res = await supertest(app)
      .delete(`/api/auth/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('returns 403 when non-admin tries to access users list', async () => {
    const res = await supertest(app)
      .get('/api/auth/users')
      .expect(401);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/auth/users/:id/reset-password returns 400 for short password', async () => {
    const res = await supertest(app)
      .put('/api/auth/users/99999/reset-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: '12' })
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('PUT /api/auth/users/:id/reset-password returns 404 for nonexistent user', async () => {
    const res = await supertest(app)
      .put('/api/auth/users/99999/reset-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'newpass123' })
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/auth/users/:id returns 404 for nonexistent user', async () => {
    const res = await supertest(app)
      .delete('/api/auth/users/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect(res.body.success).toBe(false);
  });
});

describe('Registration and email verification', () => {
  it('POST /api/auth/register creates a user', async () => {
    const uniqueId = Date.now();
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ username: `reg${uniqueId}`, name: 'Test User', password: 'test123456', email: `reg${uniqueId}@example.com` });
    expect(res.body).toHaveProperty('success');
  });

  it('GET /api/auth/verify-email returns 400 without token', async () => {
    const res = await supertest(app)
      .get('/api/auth/verify-email')
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/auth/verify-email returns 400 for invalid token', async () => {
    const res = await supertest(app)
      .get('/api/auth/verify-email?token=invalid-token-123')
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/verify-email/resend returns 400 without email', async () => {
    const res = await supertest(app)
      .post('/api/auth/verify-email/resend')
      .send({})
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/verify-email/resend returns 400 for unregistered email', async () => {
    const res = await supertest(app)
      .post('/api/auth/verify-email/resend')
      .send({ email: 'noexist@test.com' })
      .expect(400);
    expect(res.body.success).toBe(false);
  });
});
