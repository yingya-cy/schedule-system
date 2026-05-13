import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createAppWithAuth, loginAs, createTestUser } from '../../helpers/testServer';

describe('Scoring Permissions', () => {
  let app: ReturnType<typeof createAppWithAuth>;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let templateId: number;
  let competitionId: number;

  beforeAll(async () => {
    app = createAppWithAuth();
    adminToken = (await loginAs(app, 'admin', 'admin123')).token;

    await createTestUser(app, adminToken, { username: 'sc_teach', name: '评分教师', password: 'test123', role: 'teacher', department: '网编部' });
    await createTestUser(app, adminToken, { username: 'sc_stu', name: '评分学生', password: 'test123', role: 'student', department: '网编部' });

    teacherToken = (await loginAs(app, 'sc_teach', 'test123')).token;
    studentToken = (await loginAs(app, 'sc_stu', 'test123')).token;

    const auth = (req: supertest.Test) => req.set('Authorization', `Bearer ${adminToken}`);

    const tRes = await auth(supertest(app).post('/api/scoring/templates').send({
      name: '权限测试模板', description: 'test', total_score: 100, category: 'test',
      dimensions: [{ name: '技术', max_score: 50, subdimensions: [{ name: '代码', max_score: 30 }] }],
    }));
    templateId = tRes.body.data.id;

    const cRes = await auth(supertest(app).post('/api/scoring/competitions').send({ name: '权限测试比赛', template_id: templateId }));
    competitionId = cRes.body.data.id;
  });

  afterAll(async () => {
    const auth = (req: supertest.Test) => req.set('Authorization', `Bearer ${adminToken}`);
    if (competitionId) await auth(supertest(app).delete(`/api/scoring/competitions/${competitionId}`));
    if (templateId) await auth(supertest(app).delete(`/api/scoring/templates/${templateId}`));
  });

  // ---- Judge auth (judge endpoints now require code + token) ----
  describe('Judge authentication', () => {
    it('should allow judge login without code', async () => {
      // Add a judge first
      const auth = (req: supertest.Test) => req.set('Authorization', `Bearer ${adminToken}`);
      await auth(supertest(app).post(`/api/scoring/competitions/${competitionId}/judges`).send({ name: '评委1' }));
      const res = await supertest(app)
        .post('/api/scoring/judge/login')
        .send({ name: '评委1', competition_id: competitionId });
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeTruthy();
    });
    it('should return 401 for judge contestants without judge token', async () => {
      const res = await supertest(app).get('/api/scoring/judge/contestants');
      expect(res.status).toBe(401);
    });
    it('should return 401 for judge score submission without judge token', async () => {
      const res = await supertest(app)
        .post('/api/scoring/judge/scores')
        .send({ contestant_id: 999, scores: [] });
      expect(res.status).toBe(401);
    });
  });

  // ---- 401 ----
  describe('Authentication (401)', () => {
    it('should return 401 for GET /templates without token', async () => {
      await supertest(app).get('/api/scoring/templates').expect(401);
    });
    it('should return 401 for GET /competitions without token', async () => {
      await supertest(app).get('/api/scoring/competitions').expect(401);
    });
    it('should return 401 for POST /templates without token', async () => {
      await supertest(app).post('/api/scoring/templates').send({ name: 'x', total_score: 10 }).expect(401);
    });
    it('should return 401 for POST /competitions without token', async () => {
      await supertest(app).post('/api/scoring/competitions').send({ name: 'x', template_id: templateId }).expect(401);
    });
  });

  // ---- 403: teacher/student cannot admin ----
  describe('Authorization (403) for admin-only routes', () => {
    const adminOnly = [
      ['teacher', 'POST /templates', () => supertest(app).post('/api/scoring/templates').set('Authorization', `Bearer ${teacherToken}`).send({ name: 'x', total_score: 10, dimensions: [] })],
      ['teacher', 'PUT /templates/:id', () => supertest(app).put(`/api/scoring/templates/${templateId}`).set('Authorization', `Bearer ${teacherToken}`).send({ name: 'x' })],
      ['teacher', 'DELETE /templates/:id', () => supertest(app).delete(`/api/scoring/templates/${templateId}`).set('Authorization', `Bearer ${teacherToken}`)],
      ['teacher', 'POST /competitions', () => supertest(app).post('/api/scoring/competitions').set('Authorization', `Bearer ${teacherToken}`).send({ name: 'x', template_id: templateId })],
      ['teacher', 'PUT /competitions/:id', () => supertest(app).put(`/api/scoring/competitions/${competitionId}`).set('Authorization', `Bearer ${teacherToken}`).send({ name: 'x' })],
      ['teacher', 'DELETE /competitions/:id', () => supertest(app).delete(`/api/scoring/competitions/${competitionId}`).set('Authorization', `Bearer ${teacherToken}`)],
      ['teacher', 'POST contestants', () => supertest(app).post(`/api/scoring/competitions/${competitionId}/contestants`).set('Authorization', `Bearer ${teacherToken}`).send({ number: 1, name: 'x' })],
      ['teacher', 'DELETE contestants', () => supertest(app).delete(`/api/scoring/competitions/${competitionId}/contestants/1`).set('Authorization', `Bearer ${teacherToken}`)],
      ['teacher', 'POST judges', () => supertest(app).post(`/api/scoring/competitions/${competitionId}/judges`).set('Authorization', `Bearer ${teacherToken}`).send({ name: 'x' })],
      ['teacher', 'DELETE judges', () => supertest(app).delete(`/api/scoring/competitions/${competitionId}/judges/1`).set('Authorization', `Bearer ${teacherToken}`)],
      ['teacher', 'POST calculate', () => supertest(app).post(`/api/scoring/competitions/${competitionId}/calculate`).set('Authorization', `Bearer ${teacherToken}`)],
      ['teacher', 'DELETE clear-all', () => supertest(app).delete(`/api/scoring/competitions/${competitionId}/clear-all`).set('Authorization', `Bearer ${teacherToken}`)],
      ['teacher', 'POST publish', () => supertest(app).post(`/api/scoring/competitions/${competitionId}/publish`).set('Authorization', `Bearer ${teacherToken}`)],
      ['student', 'POST /templates', () => supertest(app).post('/api/scoring/templates').set('Authorization', `Bearer ${studentToken}`).send({ name: 'x', total_score: 10, dimensions: [] })],
      ['student', 'POST /competitions', () => supertest(app).post('/api/scoring/competitions').set('Authorization', `Bearer ${studentToken}`).send({ name: 'x', template_id: templateId })],
      ['student', 'POST judges', () => supertest(app).post(`/api/scoring/competitions/${competitionId}/judges`).set('Authorization', `Bearer ${studentToken}`).send({ name: 'x' })],
    ];

    for (const [role, label, fn] of adminOnly as Array<[string, string, () => supertest.Test]>) {
      it(`should return 403 when ${role} tries ${label}`, async () => {
        const res = await fn();
        expect(res.status, `${label}: expected 403 got ${res.status}`).toBe(403);
      });
    }
  });

  // ---- 200: admin authorized ----
  describe('Admin access (200)', () => {
    it('should allow admin to POST templates', async () => {
      const res = await supertest(app)
        .post('/api/scoring/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'admin template', total_score: 50, dimensions: [] });
      expect(res.status).toBe(200);
      // cleanup
      await supertest(app).delete(`/api/scoring/templates/${res.body.data.id}`).set('Authorization', `Bearer ${adminToken}`);
    });
    it('should allow admin to PUT template', async () => {
      await supertest(app)
        .put(`/api/scoring/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'admin updated' })
        .expect(200);
    });
    it('should allow admin to DELETE template', async () => {
      const res = await supertest(app)
        .post('/api/scoring/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'to-delete', total_score: 50, dimensions: [] });
      await supertest(app)
        .delete(`/api/scoring/templates/${res.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // ---- 200: non-admin read access ----
  describe('Authenticated read access (200)', () => {
    it('should allow teacher to GET templates', async () => {
      await supertest(app).get('/api/scoring/templates').set('Authorization', `Bearer ${teacherToken}`).expect(200);
    });
    it('should allow teacher to GET competitions', async () => {
      await supertest(app).get('/api/scoring/competitions').set('Authorization', `Bearer ${teacherToken}`).expect(200);
    });
    it('should allow student to GET templates', async () => {
      await supertest(app).get('/api/scoring/templates').set('Authorization', `Bearer ${studentToken}`).expect(200);
    });
    it('should allow student to GET competitions', async () => {
      await supertest(app).get('/api/scoring/competitions').set('Authorization', `Bearer ${studentToken}`).expect(200);
    });
  });
});
