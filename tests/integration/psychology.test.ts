import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createApp, loginAs } from '../helpers/testServer.ts';

let app: ReturnType<typeof createApp>;
let adminToken: string;
let counselorId: number;

beforeAll(async () => {
  app = createApp();
  const result = await loginAs(app, 'admin', 'admin123');
  adminToken = result.token;

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
    const slotDate = `2026-12-${String(Date.now() % 28 + 1).padStart(2, '0')}`;

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
    const slotDate = `2026-11-${String((Date.now() % 28) + 1).padStart(2, '0')}`;
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
