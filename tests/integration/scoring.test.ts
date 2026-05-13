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

describe('Judge Authentication Flow', () => {
  let templateId: number;
  let competitionId: number;
  let judgeCode: string;
  let judgeId: number;
  let contestantId: number;
  let judgeToken: string;

  beforeAll(async () => {
    // Create template
    const tRes = await auth(supertest(app)
      .post('/api/scoring/templates')
      .send({
        name: '评委流程模板',
        total_score: 100,
        dimensions: [{ name: '表现', max_score: 50 }, { name: '内容', max_score: 50 }],
      }));
    templateId = tRes.body.data.id;

    // Create competition
    const cRes = await auth(supertest(app)
      .post('/api/scoring/competitions')
      .send({ name: '评委流程比赛', template_id: templateId, judging_mode: 'offline' }));
    competitionId = cRes.body.data.id;

    // Update competition status to scoring
    await auth(supertest(app)
      .put(`/api/scoring/competitions/${competitionId}`)
      .send({ status: 'scoring' }));

    // Add contestant
    const ctRes = await auth(supertest(app)
      .post(`/api/scoring/competitions/${competitionId}/contestants`)
      .send({ name: '选手A', number: '1' }));
    contestantId = ctRes.body.data.id;

    // Add judge (capture code from response)
    const jRes = await auth(supertest(app)
      .post(`/api/scoring/competitions/${competitionId}/judges`)
      .send({ name: '评委张' }));
    judgeId = jRes.body.data.id;

    // Get judge list to find the code
    const listRes = await auth(supertest(app)
      .get(`/api/scoring/competitions/${competitionId}/judges`));
    const judge = listRes.body.data.find((j: any) => j.id === judgeId);
    judgeCode = judge.code;
  });

  it('allows judge login without code', async () => {
    await supertest(app)
      .post('/api/scoring/judge/login')
      .send({ name: '评委张', competition_id: competitionId })
      .expect(200);
  });

  it('logs in judge and returns token', async () => {
    const res = await supertest(app)
      .post('/api/scoring/judge/login')
      .send({ name: '评委张', competition_id: competitionId })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.name).toBe('评委张');
    judgeToken = res.body.data.token;
  });

  it('rejects contestants access without judge token', async () => {
    await supertest(app)
      .get('/api/scoring/judge/contestants')
      .expect(401);
  });

  it('returns contestants list with judge token', async () => {
    const res = await supertest(app)
      .get('/api/scoring/judge/contestants')
      .set('Authorization', `Bearer ${judgeToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('rejects score submission without judge token', async () => {
    await supertest(app)
      .post('/api/scoring/judge/scores')
      .send({ contestant_id: contestantId, scores: [] })
      .expect(401);
  });

  it('rejects score submission with empty scores array', async () => {
    await supertest(app)
      .post('/api/scoring/judge/scores')
      .set('Authorization', `Bearer ${judgeToken}`)
      .send({ contestant_id: contestantId, scores: [] })
      .expect(400);
  });

  it('submits scores for a contestant', async () => {
    const templateRes = await auth(supertest(app)
      .get(`/api/scoring/templates/${templateId}`));
    const dims = templateRes.body.data.dimensions;

    const scores = dims.map((d: any) => ({ dimension_id: d.id, score: 40 }));
    const res = await supertest(app)
      .post('/api/scoring/judge/scores')
      .set('Authorization', `Bearer ${judgeToken}`)
      .send({ contestant_id: contestantId, scores })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.total_score).toBe(80);
  });

  it('retrieves submitted scores for a contestant', async () => {
    const res = await supertest(app)
      .get(`/api/scoring/judge/scores/${contestantId}`)
      .set('Authorization', `Bearer ${judgeToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2); // 2 dimensions
  });

  it('rejects submission with expired/invalid judge token', async () => {
    await supertest(app)
      .post('/api/scoring/judge/scores')
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ contestant_id: contestantId, scores: [{ dimension_id: 1, score: 50 }] })
      .expect(401);
  });

  afterAll(async () => {
    await auth(supertest(app).delete(`/api/scoring/competitions/${competitionId}`));
    await auth(supertest(app).delete(`/api/scoring/templates/${templateId}`));
  });
});

describe('Bulk Import and Results', () => {
  let templateId: number;
  let competitionId: number;
  let judgeId: number;
  let judgeCode: string;
  let contestantIds: number[] = [];

  beforeAll(async () => {
    const tRes = await auth(supertest(app)
      .post('/api/scoring/templates')
      .send({
        name: '批量测试模板',
        total_score: 100,
        dimensions: [{ name: '评分项', max_score: 100 }],
      }));
    templateId = tRes.body.data.id;

    const cRes = await auth(supertest(app)
      .post('/api/scoring/competitions')
      .send({ name: '批量测试比赛', template_id: templateId }));
    competitionId = cRes.body.data.id;

    await auth(supertest(app)
      .put(`/api/scoring/competitions/${competitionId}`)
      .send({ status: 'scoring' }));
  });

  it('bulk imports contestants', async () => {
    const res = await auth(supertest(app)
      .post(`/api/scoring/competitions/${competitionId}/contestants/import`)
      .send({ contestants: [
        { number: '1', name: '选手1' },
        { number: '2', name: '选手2' },
        { number: '3', name: '选手3' },
      ]}))
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.inserted).toBe(3);
    contestantIds = res.body.data.ids;
  });

  it('bulk imports judges', async () => {
    const res = await auth(supertest(app)
      .post(`/api/scoring/competitions/${competitionId}/judges/import`)
      .send({ names: ['评委A', '评委B'] }))
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.inserted).toBe(2);

    const listRes = await auth(supertest(app)
      .get(`/api/scoring/competitions/${competitionId}/judges`));
    judgeId = listRes.body.data[0].id;
    judgeCode = listRes.body.data[0].code;
  });

  it('gets score details matrix', async () => {
    const res = await auth(supertest(app)
      .get(`/api/scoring/competitions/${competitionId}/score-details`))
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.judges).toBeDefined();
  });

  it('calculates results after judge submits scores', async () => {
    const loginRes = await supertest(app)
      .post('/api/scoring/judge/login')
      .send({ name: '评委A', competition_id: competitionId, code: judgeCode });
    const judgeToken = loginRes.body.data.token;
    const templateRes = await auth(supertest(app)
      .get(`/api/scoring/templates/${templateId}`));
    const dimId = templateRes.body.data.dimensions[0].id;

    for (const cid of contestantIds) {
      await supertest(app)
        .post('/api/scoring/judge/scores')
        .set('Authorization', `Bearer ${judgeToken}`)
        .send({ contestant_id: cid, scores: [{ dimension_id: dimId, score: 80 }] });
    }

    const res = await auth(supertest(app)
      .post(`/api/scoring/competitions/${competitionId}/calculate`))
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('publishes results', async () => {
    const res = await auth(supertest(app)
      .post(`/api/scoring/competitions/${competitionId}/publish`))
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('returns published results', async () => {
    const res = await auth(supertest(app)
      .get(`/api/scoring/competitions/${competitionId}/results`))
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('returns live results', async () => {
    const res = await auth(supertest(app)
      .get(`/api/scoring/competitions/${competitionId}/live-results`))
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('exports results as xlsx', async () => {
    const res = await auth(supertest(app)
      .get(`/api/scoring/competitions/${competitionId}/export`))
      .expect(200);
    expect(res.headers['content-type']).toContain('spreadsheet');
  });

  it('returns scoring history', async () => {
    const res = await auth(supertest(app)
      .get('/api/scoring/history'))
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('clears all data for competition', async () => {
    const res = await auth(supertest(app)
      .delete(`/api/scoring/competitions/${competitionId}/clear-all`))
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  afterAll(async () => {
    await auth(supertest(app).delete(`/api/scoring/competitions/${competitionId}`));
    await auth(supertest(app).delete(`/api/scoring/templates/${templateId}`));
  });
});

describe('Export results endpoint', () => {
  let app2: ReturnType<typeof createApp>;
  let token2: string;

  beforeAll(async () => {
    app2 = createApp();
    token2 = (await loginAs(app2, 'admin', 'admin123')).token;
  });

  it('POST /api/scoring/export-results returns 500 without files (AI not available)', async () => {
    const res = await supertest(app2)
      .post('/api/scoring/export-results')
      .set('Authorization', `Bearer ${token2}`)
      .field('result_data', JSON.stringify({ test: true }))
      .expect(500);

    expect(res.body.success).toBe(false);
  });
});
