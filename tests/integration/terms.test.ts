import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { createAppWithAuth, loginAs } from '../helpers/testServer';

describe('Terms API', () => {
  let app: ReturnType<typeof createAppWithAuth>;
  let adminToken: string;

  beforeAll(async () => {
    app = createAppWithAuth();
    adminToken = (await loginAs(app, 'admin', 'admin123')).token;
  });

  describe('GET /api/terms/current', () => {
    it('returns active term without auth', async () => {
      const res = await supertest(app).get('/api/terms/current').expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeTruthy();
      expect(res.body.data.status).toBe('active');
    });
  });

  describe('GET /api/terms', () => {
    it('returns list with auth', async () => {
      const res = await supertest(app)
        .get('/api/terms')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/terms/transition', () => {
    it('returns 401 without auth', async () => {
      await supertest(app).post('/api/terms/transition').expect(401);
    });

    it('returns 400 when missing required fields', async () => {
      await supertest(app)
        .post('/api/terms/transition')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('completes transition: archives old term, creates new active', async () => {
      const res = await supertest(app)
        .post('/api/terms/transition')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ academic_year: '2025-2026', semester: '春', retain_user_ids: [], remove_user_ids: [] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.new_term.sequence_number).toBeGreaterThan(0);

      // Verify new term is active
      const currentRes = await supertest(app).get('/api/terms/current');
      expect(currentRes.body.data.name).toBe(res.body.data.new_term.name);

      // Verify old term is archived
      const listRes = await supertest(app)
        .get('/api/terms')
        .set('Authorization', `Bearer ${adminToken}`);
      const archived = listRes.body.data.filter((t: any) => t.status === 'archived');
      expect(archived.length).toBeGreaterThan(0);
    });
  });
});

describe('Schedule term filtering', () => {
  let app: ReturnType<typeof createAppWithAuth>;
  let teacherToken: string;

  beforeAll(async () => {
    app = createAppWithAuth();
    const { token } = await loginAs(app, 'fc_tw', 'test123');
    teacherToken = token;
  });

  it('GET /api/schedules defaults to active term', async () => {
    const res = await supertest(app)
      .get('/api/schedules')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/schedules accepts term_id filter', async () => {
    // Get current term
    const termRes = await supertest(app).get('/api/terms/current');
    const termId = termRes.body.data.id;

    const res = await supertest(app)
      .get(`/api/schedules?term_id=${termId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});
