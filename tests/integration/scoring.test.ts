import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp, loginAs } from '../helpers/testServer.ts';

let app: ReturnType<typeof createApp>;
let adminToken: string;

beforeAll(async () => {
  app = createApp();
  adminToken = (await loginAs(app, 'admin', 'admin123')).token;
});

const auth = (req: supertest.Test) => req.set('Authorization', `Bearer ${adminToken}`);

describe('Template CRUD', () => {
  let templateId: number;

  it('POST /api/scoring/templates creates a template', async () => {
    const res = await auth(supertest(app)
      .post('/api/scoring/templates')
      .send({
        name: '测试评分模板',
        description: '集成测试模板',
        total_score: 100,
        category: 'test',
        dimensions: [
          { name: '技术', max_score: 50, subdimensions: [{ name: '代码质量', max_score: 30 }] },
          { name: '创意', max_score: 50, subdimensions: [{ name: '原创性', max_score: 30 }] },
        ],
      }))
      .expect(200);

    expect(res.body.success).toBe(true);
    templateId = res.body.data.id;
  });

  it('GET /api/scoring/templates lists templates', async () => {
    const res = await auth(supertest(app)
      .get('/api/scoring/templates'))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/scoring/templates/:id returns template detail', async () => {
    const res = await auth(supertest(app)
      .get(`/api/scoring/templates/${templateId}`))
      .expect(200);

    expect(res.body.data.name).toBe('测试评分模板');
    expect(res.body.data.dimensions).toHaveLength(2);
  });

  it('PUT /api/scoring/templates/:id updates template', async () => {
    const res = await auth(supertest(app)
      .put(`/api/scoring/templates/${templateId}`)
      .send({
        name: '更新的模板',
        total_score: 100,
        dimensions: [{ name: '综合', max_score: 100, subdimensions: [{ name: '表现', max_score: 100 }] }],
      }))
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  afterAll(async () => {
    await auth(supertest(app).delete(`/api/scoring/templates/${templateId}`));
  });
});

describe('Competition and Contestants', () => {
  let templateId: number;
  let competitionId: number;

  beforeAll(async () => {
    const tRes = await auth(supertest(app)
      .post('/api/scoring/templates')
      .send({
        name: '比赛测试模板',
        total_score: 50,
        dimensions: [{ name: '维度A', max_score: 50, subdimensions: [{ name: '子维度1', max_score: 50 }] }],
      }));
    templateId = tRes.body.data.id;
  });

  it('POST /api/scoring/competitions creates competition', async () => {
    const res = await auth(supertest(app)
      .post('/api/scoring/competitions')
      .send({ name: '测试比赛', template_id: templateId }))
      .expect(200);

    expect(res.body.success).toBe(true);
    competitionId = res.body.data.id;
  });

  it('GET /api/scoring/competitions lists competitions', async () => {
    const res = await auth(supertest(app)
      .get('/api/scoring/competitions'))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/scoring/competitions/:id/contestants adds contestant', async () => {
    const res = await auth(supertest(app)
      .post(`/api/scoring/competitions/${competitionId}/contestants`)
      .send({ number: 1, name: '选手A', group_name: 'A组' }))
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('GET /api/scoring/competitions/:id/contestants lists contestants', async () => {
    const res = await auth(supertest(app)
      .get(`/api/scoring/competitions/${competitionId}/contestants`))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/scoring/competitions/:id/judges adds judge', async () => {
    const res = await auth(supertest(app)
      .post(`/api/scoring/competitions/${competitionId}/judges`)
      .send({ name: '评委张' }))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeGreaterThan(0);
  });

  it('GET /api/scoring/competitions/:id/judges lists judges', async () => {
    const res = await auth(supertest(app)
      .get(`/api/scoring/competitions/${competitionId}/judges`))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  afterAll(async () => {
    await auth(supertest(app).delete(`/api/scoring/competitions/${competitionId}`));
    await auth(supertest(app).delete(`/api/scoring/templates/${templateId}`));
  });
});
