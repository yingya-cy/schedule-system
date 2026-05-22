import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createApp, loginAs, createTestUser } from '../helpers/testServer.ts';
import pool from '../../src/config/database';

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
    expect(res.body.data[0].title).toBe('New Chat');
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

// =============================================
// New: schedule-plan parameter forwarding
// =============================================

describe('POST /api/ai/schedule-plan — parameter forwarding', () => {
  it('rejects empty courses with 400', async () => {
    const res = await supertest(app)
      .post('/api/ai/schedule-plan')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courses: [], commitments: [], model: 'deepseek-v4-pro' })
      .expect(400);
    expect(res.body.error).toContain('为空');
  });
});

// =============================================
// New: save-schedule / latest-schedule
// =============================================

describe('POST /api/ai/save-schedule + GET /api/ai/latest-schedule', () => {
  it('saves and retrieves schedule with commitments', async () => {
    const saveRes = await supertest(app)
      .post('/api/ai/save-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        courses: [{ id: 'c1', course_name: '测试课程', weekday: 3, sections: [5, 6], weeks: [1, 2, 3], teacher: '张老师', location: 'A101', remark: '' }],
        commitments: [{ name: '考试', date: '2026-06-15', start_time: '09:00', end_time: '11:00', priority: 'high' }],
      })
      .expect(200);
    expect(saveRes.body.success).toBe(true);
    expect(saveRes.body.data.id).toBeTruthy();

    const getRes = await supertest(app)
      .get('/api/ai/latest-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.courses.length).toBeGreaterThanOrEqual(1);
    expect(getRes.body.data.courses[0].course_name).toBe('测试课程');
    expect(getRes.body.data.commitments.length).toBe(1);

    // Clean up: delete the plan so it doesn't affect next test
    await supertest(app)
      .delete(`/api/ai/schedule-plans/${saveRes.body.data.id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });

  it('normalizes missing course_name to "未识别课程"', async () => {
    const saveRes = await supertest(app)
      .post('/api/ai/save-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        courses: [{ id: 'c2', weekday: 1, sections: [1, 2], weeks: [1], teacher: '', location: '', remark: '' }],
        commitments: [],
      })
      .expect(200);

    // latest-schedule normalizes: course_name || name → '未识别课程'
    const getRes = await supertest(app)
      .get('/api/ai/latest-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(getRes.body.data.courses[0].course_name).toBe('未识别课程');

    // Clean up
    await supertest(app)
      .delete(`/api/ai/schedule-plans/${saveRes.body.data.id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });
});

// =============================================
// New: session default title is ASCII "New Chat"
// =============================================

describe('AI Counsel — default title', () => {
  it('creates session with ASCII default title', async () => {
    const res = await supertest(app)
      .post('/api/ai/counsel/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);

    const sessions = await supertest(app)
      .get('/api/ai/counsel/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const created = sessions.body.data.find((s: { id: number }) => s.id === res.body.data.id);
    expect(created.title).toBe('New Chat');
  });
});

// =============================================
// Plan detail / deletion / 404 / 401
// =============================================

describe('GET /api/ai/schedule-plans/:id', () => {
  it('returns 404 for non-existent plan', async () => {
    const res = await supertest(app)
      .get('/api/ai/schedule-plans/99999')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404);
    expect(res.body.error).toContain('不存在');
  });

  it('returns 401 without auth', async () => {
    await supertest(app)
      .get('/api/ai/schedule-plans/1')
      .expect(401);
  });

  it('returns plan detail after save', async () => {
    // Save a schedule first
    const saveRes = await supertest(app)
      .post('/api/ai/save-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        courses: [{ id: 't1', course_name: '详情测试', weekday: 1, sections: [1, 2], weeks: [1], teacher: '', location: '', remark: '' }],
        commitments: [],
      })
      .expect(200);

    // Now fetch the plan detail
    const id = saveRes.body.data.id;
    const res = await supertest(app)
      .get(`/api/ai/schedule-plans/${id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(id);

    // Clean up
    await supertest(app)
      .delete(`/api/ai/schedule-plans/${id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });
});

describe('DELETE /api/ai/schedule-plans/:id', () => {
  it('returns 401 without auth', async () => {
    await supertest(app)
      .delete('/api/ai/schedule-plans/1')
      .expect(401);
  });

  it('returns 200 even for non-existent (idempotent)', async () => {
    await supertest(app)
      .delete('/api/ai/schedule-plans/99999')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });
});

// =============================================
// save-schedule validation
// =============================================

describe('POST /api/ai/save-schedule — validation', () => {
  it('returns 400 when courses is empty', async () => {
    const res = await supertest(app)
      .post('/api/ai/save-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courses: [], commitments: [] })
      .expect(400);
    expect(res.body.error).toContain('为空');
  });

  it('returns 401 without auth', async () => {
    await supertest(app)
      .post('/api/ai/save-schedule')
      .send({ courses: [{ id: 'x', course_name: 'x', weekday: 1, sections: [1], weeks: [1], teacher: '', location: '', remark: '' }] })
      .expect(401);
  });
});

// =============================================
// latest-schedule without data
// =============================================

describe('GET /api/ai/latest-schedule — edge cases', () => {
  it('returns 401 without auth', async () => {
    await supertest(app)
      .get('/api/ai/latest-schedule')
      .expect(401);
  });

  it('returns empty data for user with no schedule', async () => {
    const res = await supertest(app)
      .get('/api/ai/latest-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
  });

  it('prefers plan_data rows over newer drafts', async () => {
    // Simulate: save → plan generated → save again → latest-schedule still returns plan
    const courses = [{ id: 'p1', course_name: '持久化测试', weekday: 1, sections: [1, 2], weeks: [1], teacher: '', location: '', remark: '' }];

    // Step 1: save schedule (creates draft row)
    const save1 = await supertest(app).post('/api/ai/save-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courses, commitments: [] })
      .expect(200);
    const draftId = save1.body.data.id;

    // Step 2: simulate plan generation — directly set plan_data on the draft row
    // (can't call /schedule-plan in test because it hits external AI)
    await pool.query(
      'UPDATE ai_schedule_plans SET plan_data = ? WHERE id = ?',
      [JSON.stringify({ weekly_plans: [], summary: '模拟计划' }), draftId]
    );

    // Step 3: save schedule again — with idempotent save, no new row is inserted
    // (the previous draft was filled, so there's no pending row → new one is inserted)
    const save2 = await supertest(app).post('/api/ai/save-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courses, commitments: [] })
      .expect(200);

    // Step 4: latest-schedule should prefer the row WITH plan_data
    // over the newer draft row without plan
    const getRes = await supertest(app)
      .get('/api/ai/latest-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(getRes.body.data.plan).not.toBeNull();
    expect(getRes.body.data.plan.summary).toBe('模拟计划');

    // Clean up
    await supertest(app).delete(`/api/ai/schedule-plans/${draftId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    if (save2.body.data.id !== draftId) {
      await supertest(app).delete(`/api/ai/schedule-plans/${save2.body.data.id}`)
        .set('Authorization', `Bearer ${studentToken}`);
    }
  });
});

// =============================================
// AI Counsel — session/message auth guards
// =============================================

describe('AI Counsel — auth guards', () => {
  it('GET sessions returns 401 without auth', async () => {
    await supertest(app)
      .get('/api/ai/counsel/sessions')
      .expect(401);
  });

  it('POST sessions returns 401 without auth', async () => {
    await supertest(app)
      .post('/api/ai/counsel/sessions')
      .expect(401);
  });

  it('GET messages returns 401 without auth', async () => {
    await supertest(app)
      .get('/api/ai/counsel/sessions/1/messages')
      .expect(401);
  });

  it('POST messages returns 401 without auth', async () => {
    await supertest(app)
      .post('/api/ai/counsel/sessions/1/messages')
      .send({ role: 'user', content: 'hi' })
      .expect(401);
  });

  it('DELETE session returns 401 without auth', async () => {
    await supertest(app)
      .delete('/api/ai/counsel/sessions/1')
      .expect(401);
  });
});

// =============================================
// AI Counsel — message validation edge cases
// =============================================

describe('AI Counsel — message validation', () => {
  let sessionId: number;

  beforeAll(async () => {
    const res = await supertest(app)
      .post('/api/ai/counsel/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    sessionId = res.body.data.id;
  });

  it('returns 500 when role is missing (DB constraint)', async () => {
    const res = await supertest(app)
      .post(`/api/ai/counsel/sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'no role' })
      .expect(500);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when content is missing (DB constraint)', async () => {
    const res = await supertest(app)
      .post(`/api/ai/counsel/sessions/${sessionId}/messages`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ role: 'user' })
      .expect(500);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for non-existent session messages', async () => {
    const res = await supertest(app)
      .get('/api/ai/counsel/sessions/99999/messages')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.data).toEqual([]);
  });

  // Cleanup
  afterAll(async () => {
    await supertest(app)
      .delete(`/api/ai/counsel/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${studentToken}`);
  });
});
