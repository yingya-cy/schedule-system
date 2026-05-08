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
  });
});
