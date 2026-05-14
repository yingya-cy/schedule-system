import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createApp, loginAs, createTestUser } from '../helpers/testServer.ts';

let app: ReturnType<typeof createApp>;
let adminToken: string;
let studentToken: string;

beforeAll(async () => {
  app = createApp();
  const admin = await loginAs(app, 'admin', 'admin123');
  adminToken = admin.token;

  // Create a test student
  const username = `ai_test_${Date.now()}`;
  await createTestUser(app, adminToken, {
    username,
    name: 'AI测试学生',
    password: 'test123',
    role: 'student',
    department: '咨询部',
  });
  const student = await loginAs(app, username, 'test123');
  studentToken = student.token;
});

// =============================================
// User Profile — grade/major
// =============================================

describe('PUT /api/auth/me — grade/major', () => {
  it('sets grade and major', async () => {
    const res = await supertest(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ grade: '2024级', major: '计算机科学' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updated).toBe(true);
  });

  it('returns grade and major in profile', async () => {
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.data.grade).toBe('2024级');
    expect(res.body.data.major).toBe('计算机科学');
  });

  it('updates grade separately', async () => {
    await supertest(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ grade: '2025级' })
      .expect(200);

    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.data.grade).toBe('2025级');
    expect(res.body.data.major).toBe('计算机科学'); // unchanged
  });
});

// =============================================
// AI Schedule Plans
// =============================================

describe('GET /api/ai/schedule-plans', () => {
  it('returns empty list for new user', async () => {
    const res = await supertest(app)
      .get('/api/ai/schedule-plans')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    await supertest(app)
      .get('/api/ai/schedule-plans')
      .expect(401);
  });
});

describe('POST /api/ai/schedule-plan', () => {
  it('returns 400 when courses is empty', async () => {
    const res = await supertest(app)
      .post('/api/ai/schedule-plan')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courses: [], commitments: [] })
      .expect(400);
    expect(res.body.success).toBe(false);
  });
});

// =============================================
// AI Counsel Sessions
// =============================================

describe('AI Counsel Sessions CRUD', () => {
  let sessionId: number;

  it('POST creates a new session', async () => {
    const res = await supertest(app)
      .post('/api/ai/counsel/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    sessionId = res.body.data.id;
  });

  it('GET lists sessions', async () => {
    const res = await supertest(app)
      .get('/api/ai/counsel/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].title).toBe('新对话');
  });

  it('GET session messages returns empty', async () => {
    const res = await supertest(app)
      .get(`/api/ai/counsel/sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('POST saves a message', async () => {
    const res = await supertest(app)
      .post(`/api/ai/counsel/sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ role: 'user', content: 'Hello' })
      .expect(200);
    expect(res.body.success).toBe(true);

    const msgs = await supertest(app)
      .get(`/api/ai/counsel/sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(msgs.body.data.length).toBe(1);
    expect(msgs.body.data[0].role).toBe('user');
  });

  it('DELETE removes a session', async () => {
    await supertest(app)
      .delete(`/api/ai/counsel/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });
});

describe('POST /api/ai/counsel/stream', () => {
  it('returns 400 when messages is missing', async () => {
    const res = await supertest(app)
      .post('/api/ai/counsel/stream')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({})
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when message is too long', async () => {
    const res = await supertest(app)
      .post('/api/ai/counsel/stream')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ messages: [{ role: 'user', content: 'x'.repeat(2001) }] })
      .expect(400);
    expect(res.body.error).toContain('过长');
  });
});
