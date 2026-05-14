import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createApp, loginAs, createTestUser } from '../helpers/testServer.ts';

let app: ReturnType<typeof createApp>;
let adminToken: string;
let studentToken: string;
let counselorId: number;

beforeAll(async () => {
  app = createApp();
  const result = await loginAs(app, 'admin', 'admin123');
  adminToken = result.token;

  // Create a non-counselor test user for /me tests
  const testUsername = `psych_student_${Date.now()}`;
  await createTestUser(app, adminToken, {
    username: testUsername,
    name: '心理测试学生',
    password: 'test123',
    role: 'student',
  });
  const studentLogin = await loginAs(app, testUsername, 'test123');
  studentToken = studentLogin.token;

  // Get first available counselor
  const res = await supertest(app)
    .get('/api/psychology/counselors')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  const counselors = res.body.data;
  if (counselors.length > 0) {
    counselorId = counselors[0].id;
  }
});

describe('GET /api/psychology/me', () => {
  it('returns counselor profile for admin (who is a counselor)', async () => {
    const res = await supertest(app)
      .get('/api/psychology/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.name).toBe('张老师');
  });

  it('returns null for non-counselor user', async () => {
    const res = await supertest(app)
      .get('/api/psychology/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
  });
});

describe('GET /api/psychology/counselors', () => {
  it('returns 401 without auth', async () => {
    const res = await supertest(app)
      .get('/api/psychology/counselors')
      .expect(401);
    expect(res.body.success).toBe(false);
  });

  it('returns counselor list with slots', async () => {
    const res = await supertest(app)
      .get('/api/psychology/counselors')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/psychology/counselors/:id', () => {
  it('returns counselor detail with parsed slots', async () => {
    if (!counselorId) return;
    const res = await supertest(app)
      .get(`/api/psychology/counselors/${counselorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBeTruthy();
    expect(Array.isArray(res.body.data.slots)).toBe(true);
    if (res.body.data.slots.length > 0) {
      const slot = res.body.data.slots[0];
      expect(typeof slot.day_of_week).toBe('number');
      expect(slot.start_time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(slot.end_time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    }
  });

  it('returns 404 for non-existent counselor', async () => {
    const res = await supertest(app)
      .get('/api/psychology/counselors/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(res.body.error).toContain('不存在');
  });
});

describe('POST /api/psychology/chat/conversations', () => {
  it('creates a new conversation', async () => {
    if (!counselorId) return;
    const res = await supertest(app)
      .post('/api/psychology/chat/conversations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ counselor_id: counselorId })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
  });

  it('returns existing conversation on duplicate', async () => {
    if (!counselorId) return;
    const res = await supertest(app)
      .post('/api/psychology/chat/conversations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ counselor_id: counselorId })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
  });
});

describe('GET /api/psychology/chat/conversations', () => {
  it('returns conversation list', async () => {
    const res = await supertest(app)
      .get('/api/psychology/chat/conversations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/psychology/appointments', () => {
  it('creates an appointment and rejects duplicate', async () => {
    if (!counselorId) return;
    // 使用唯一日期避免跨运行数据污染
    const day = ((Date.now() * 7) % 25) + 1;
    const slotDate = `2027-03-${String(Math.floor(day)).padStart(2, '0')}`;

    // 第一次创建应成功
    const res1 = await supertest(app)
      .post('/api/psychology/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        counselor_id: counselorId,
        slot_date: slotDate,
        slot_start: '11:00:00',
        slot_end: '11:30:00',
      })
      .expect(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.id).toBeTruthy();

    // 同一位咨询师同一时段再次预约应返回 409
    const res2 = await supertest(app)
      .post('/api/psychology/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        counselor_id: counselorId,
        slot_date: slotDate,
        slot_start: '11:00:00',
        slot_end: '11:30:00',
      })
      .expect(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error).toContain('已被预约');
  });
});

describe('GET /api/psychology/appointments', () => {
  it('returns my appointments', async () => {
    const res = await supertest(app)
      .get('/api/psychology/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('PUT /api/psychology/appointments/:id/cancel', () => {
  it('cancels an appointment', async () => {
    if (!counselorId) return;
    const day = ((Date.now() * 13) % 25) + 1;
    const slotDate = `2027-02-${String(Math.floor(day)).padStart(2, '0')}`;
    const create = await supertest(app)
      .post('/api/psychology/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        counselor_id: counselorId,
        slot_date: slotDate,
        slot_start: '16:00:00',
        slot_end: '16:30:00',
      })
      .expect(200);

    const res = await supertest(app)
      .put(`/api/psychology/appointments/${create.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-existent appointment', async () => {
    const res = await supertest(app)
      .put('/api/psychology/appointments/99999/cancel')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(res.body.error).toContain('不存在');
  });
});

// =============================================
// Admin counselor CRUD
// =============================================

describe('POST /api/psychology/counselors (admin)', () => {
  it('admin creates a counselor', async () => {
    const res = await supertest(app)
      .post('/api/psychology/counselors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: 94, name: '测试咨询师', title: '实习咨询师', bio: '测试用' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
  });

  it('returns 403 for non-admin', async () => {
    const res = await supertest(app)
      .post('/api/psychology/counselors')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ user_id: 94, name: '非法创建' })
      .expect(403);

    expect(res.body.success).toBe(false);
  });
});

describe('PUT /api/psychology/counselors/:id (admin)', () => {
  it('admin updates counselor info', async () => {
    if (!counselorId) return;
    const res = await supertest(app)
      .put(`/api/psychology/counselors/${counselorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '更新后的职称' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});

describe('PUT /api/psychology/counselors/:id/toggle (admin)', () => {
  it('toggles counselor active status', async () => {
    if (!counselorId) return;
    const res = await supertest(app)
      .put(`/api/psychology/counselors/${counselorId}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});

describe('POST / DELETE counselor slots (admin)', () => {
  let slotId: number;

  it('adds a slot', async () => {
    if (!counselorId) return;
    const res = await supertest(app)
      .post(`/api/psychology/counselors/${counselorId}/slots`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ day_of_week: 6, start_time: '10:00:00', end_time: '11:00:00' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    slotId = res.body.data.id;
  });

  it('deletes the slot', async () => {
    if (!counselorId || !slotId) return;
    const res = await supertest(app)
      .delete(`/api/psychology/counselors/${counselorId}/slots/${slotId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});

// =============================================
// Admin appointments overview
// =============================================

describe('GET /api/psychology/appointments/all (admin)', () => {
  it('admin sees all appointments', async () => {
    const res = await supertest(app)
      .get('/api/psychology/appointments/all')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('admin filters by status', async () => {
    const res = await supertest(app)
      .get('/api/psychology/appointments/all?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    res.body.data.forEach((a: { status: string }) => {
      expect(a.status).toBe('pending');
    });
  });

  it('returns 403 for non-admin', async () => {
    const res = await supertest(app)
      .get('/api/psychology/appointments/all')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    expect(res.body.success).toBe(false);
  });
});
